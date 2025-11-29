import { pool } from "./index.js";
import sharp from "sharp";

const FACE_VERSION = 0.1;

export async function insertFacesIntoDB(originalBuffer, hash, faces) {
  const image = sharp(originalBuffer);
  const meta = await image.metadata();

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

    // Insert into DB
    await pool.query(
      `
      INSERT INTO faces
      (photo_hash, face_index, bbox, landmarks, confidence, crop_base64, embedding, embedding_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        hash,
        i,
        JSON.stringify(face.bbox),
        JSON.stringify(face.landmark),
        face.det_score ?? null,
        cropBase64,
        `[${face.normed_embedding.join(",")}]`, // pgvector format
        FACE_VERSION,
      ],
    );

    console.log(`Inserted face ${i} for ${hash}`);
  }
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

  // 2. Convert new faces' embeddings (already in memory)
  const FACE_THRESHOLD = 0.25;

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

      // await pool.query(`UPDATE faces SET person_id = $1 WHERE id = $2`, [
      //   bestMatch.person_id,
      //   face.id,
      // ]);
    } else {
      console.log(
        `Face ${face.id} did NOT match. Best = ${bestMatch.dist.toFixed(4)}`,
      );
    }
  }
}
