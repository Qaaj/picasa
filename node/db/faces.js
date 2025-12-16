import { pool } from "./index.js";
import sharp from "sharp";

const FACE_VERSION = 0.1;

export async function loadFacesForPhoto(photoHash) {
  const res = await pool.query(
    `
    SELECT
      f.id,
      f.face_index,
      f.crop_base64,
      f.person_id,
      p.name AS person_name,
      f.cluster_id,
      fc.face_count,
      fc.id AS cluster_id,
      f.bbox,
      f.landmarks,
      f.confidence,
      f.ignored
    FROM faces f
    LEFT JOIN people p ON p.id = f.person_id
    LEFT JOIN face_clusters fc ON fc.id = f.cluster_id
    WHERE f.photo_hash = $1
    ORDER BY f.face_index
    `,
    [photoHash]
  );

  return res.rows;
}

export async function insertFacesIntoDB(originalBuffer, hash, faces) {
  const image = sharp(originalBuffer);
  const meta = await image.metadata();

  let insertedFaces = [];

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const [x1, y1, x2, y2] = face.bbox;

    // Safe extraction bounds
    const left = Math.max(0, Math.floor(x1));
    const top = Math.max(0, Math.floor(y1));
    const width = Math.min(meta.width - left, Math.floor(x2 - x1));
    const height = Math.min(meta.height - top, Math.floor(y2 - y1));

    // Generate crop base64
    const cropBuffer = await sharp(originalBuffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 90 })
      .toBuffer();

    const cropBase64 = cropBuffer.toString("base64");

    // Insert into DB and RETURN the inserted row
    const res = await pool.query(
      `
      INSERT INTO faces
      (photo_hash, face_index, bbox, landmarks, confidence, crop_base64, embedding, embedding_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, embedding::text
      `,
      [
        hash,
        i,
        JSON.stringify(face.bbox),
        JSON.stringify(face.landmark),
        face.det_score ?? null,
        cropBase64,
        `[${face.normed_embedding.join(",")}]`,
        FACE_VERSION,
      ],
    );

    console.log(`Inserted face ${i} for ${hash}`);

    if (!Array.isArray(insertedFaces)) insertedFaces = [];
    insertedFaces.push({
      id: res.rows[0].id,
      embedding: res.rows[0].embedding,
      normed_embedding: face.normed_embedding,
    });
  }

  return insertedFaces;
}

export async function markPhotoScanned(hash) {
  await pool.query(`UPDATE photos SET face_scanned = $1 WHERE file_hash = $2`, [
    FACE_VERSION,
    hash,
  ]);
}

// Parse "[0.11, -0.22, ...]" → [0.11, -0.22, ...]
function parseVec(str) {
  const inner = str.slice(1, -1);
  return inner.split(",").map(Number);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v) {
  return Math.sqrt(dot(v, v));
}

function cosineDistance(a, b) {
  const na = norm(a);
  const nb = norm(b);
  const cosSim = dot(a, b) / (na * nb);
  return 1 - cosSim;
}

export async function checkForSimilarFaces(newFaces) {
  if (!newFaces || newFaces.length === 0) return;

  // 1. Load all golden vectors
  const peopleRes = await pool.query(`
     SELECT id, name, identity_vector::text AS emb
     FROM people
     WHERE identity_vector IS NOT NULL
   `);

  const people = peopleRes.rows.map((r) => ({
    id: r.id,
    name: r.name,
    vec: parseVec(r.emb),
  }));

  if (people.length === 0) {
    console.log("No people with golden vectors available.");
    return;
  }

  // Load all clusters
  const clustersRes = await pool.query(`
    SELECT id, centroid::text AS emb, face_count
    FROM face_clusters
  `);

  const clusters = clustersRes.rows.map((r) => ({
    id: r.id,
    centroid: parseVec(r.emb),
    face_count: r.face_count,
  }));

  // 2. Convert new faces' embeddings (already in memory)
  const FACE_THRESHOLD = 0.30;
  const CLUSTER_THRESHOLD = 0.35;

  for (const face of newFaces) {
    // face must contain: { id, embedding }
    if (!face.normed_embedding) continue;

    const faceVec =
      typeof face.normed_embedding === "string"
        ? parseVec(face.normed_embedding)
        : face.normed_embedding;

    let bestMatch = null;

    for (const person of people) {
      const dist = cosineDistance(faceVec, person.vec);
      if (!bestMatch || dist < bestMatch.dist) {
        bestMatch = { person_id: person.id, dist, name: person.name };
      }
    }

    if (!bestMatch) continue;

    // Auto-assign if below threshold
    if (bestMatch.dist < FACE_THRESHOLD) {
      console.log(
        `Auto-assign face ${face.id} → person ${bestMatch.name} (dist=${bestMatch.dist.toFixed(4)})`,
      );

      await pool.query(
        `UPDATE faces SET person_id = $1, cluster_id = NULL WHERE id = $2`,
        [bestMatch.person_id, face.id]
      );
    } else {
      console.log(
        `Face ${face.id} did NOT match. Best = ${bestMatch.dist.toFixed(4)}`,
      );
    }
    // Create a new cluster when no person match is good enough

    if (bestMatch.dist >= FACE_THRESHOLD) {
      const { createCluster, assignFaceToCluster } = await import("../db/faceClusters.js");

      // Check clusters for match
      let bestCluster = null;
      for (const cluster of clusters) {
        const dist = cosineDistance(faceVec, cluster.centroid);
        if (!bestCluster || dist < bestCluster.dist) {
          bestCluster = { id: cluster.id, dist, centroid: cluster.centroid, face_count: cluster.face_count };
        }
      }

      if (bestCluster && bestCluster.dist < CLUSTER_THRESHOLD) {
        // Assign face to this cluster and update centroid
        await assignFaceToCluster(face.id, bestCluster.id);

        // Incrementally update centroid: new_centroid = ((old_centroid * count) + faceVec) / (count + 1)
        const newCount = bestCluster.face_count + 1;
        const newCentroid = bestCluster.centroid.map(
          (val, idx) => (val * bestCluster.face_count + faceVec[idx]) / newCount,
        );

        await pool.query(
          `UPDATE face_clusters SET centroid = $1, face_count = $2 WHERE id = $3`,
          [`[${newCentroid.join(",")}]`, newCount, bestCluster.id],
        );

        console.log(`Assigned face ${face.id} to existing cluster ${bestCluster.id}`);
      } else {
        // No cluster match, create new cluster
        const newClusterId = await createCluster(faceVec);
        await assignFaceToCluster(face.id, newClusterId);

        console.log(`Created new cluster ${newClusterId} for face ${face.id}`);
      }
    }
  }
}
