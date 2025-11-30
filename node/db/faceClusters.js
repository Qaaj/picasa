import { pool } from "./index.js";
import { cosineDistance } from "../helpers/vector.js";
import { parseVec } from "../helpers/vector.js";

// -------------------------------------------
// Fetch all clusters
// -------------------------------------------
export async function getAllClusters() {
  const res = await pool.query(`
    SELECT id, centroid::text AS emb, face_count
    FROM face_clusters
    ORDER BY id
  `);

  return res.rows.map(r => ({
    id: r.id,
    centroid: parseVec(r.emb),
    face_count: r.face_count
  }));
}

// -------------------------------------------
// Create a new cluster with a single embedding
// -------------------------------------------
export async function createCluster(embedding) {
  const centroidText = `[${
    embedding.map(v => v.toFixed(6)).join(",")
  }]`;

  const res = await pool.query(
    `
      INSERT INTO face_clusters (centroid, face_count)
      VALUES ($1, 1)
      RETURNING id
    `,
    [centroidText]
  );

  return res.rows[0].id;
}

// -------------------------------------------
// Update cluster centroid (running average)
// -------------------------------------------
export async function updateClusterCentroid(clusterId, newEmbedding) {
  const { rows } = await pool.query(
    `SELECT centroid::text AS emb, face_count
     FROM face_clusters
     WHERE id = $1`,
    [clusterId]
  );

  if (rows.length === 0) return;

  const oldCentroid = parseVec(rows[0].emb);
  const oldCount = rows[0].face_count;

  const newCount = oldCount + 1;
  const updated = oldCentroid.map((v, i) => (v * oldCount + newEmbedding[i]) / newCount);

  const centroidText = `[${
    updated.map(v => v.toFixed(6)).join(",")
  }]`;

  await pool.query(
    `
      UPDATE face_clusters
      SET centroid = $1, face_count = face_count + 1
      WHERE id = $2
    `,
    [centroidText, clusterId]
  );
}

// -------------------------------------------
// Assign a face to a cluster
// -------------------------------------------
export async function assignFaceToCluster(faceId, clusterId) {
  await pool.query(
    `UPDATE faces SET cluster_id = $1 WHERE id = $2`,
    [clusterId, faceId]
  );
}

// -------------------------------------------
// Get faces by file hash
// -------------------------------------------
export async function getFacesByHash(hash) {
  const res = await pool.query(
    `SELECT id, embedding::text AS emb
     FROM faces
     WHERE file_hash = $1`,
    [hash]
  );

  return res.rows.map(r => ({
    id: r.id,
    embedding: parseVec(r.emb)
  }));
}

// -------------------------------------------
// Find best matching cluster under threshold
// -------------------------------------------
export async function findBestCluster(embedding, threshold = 0.25) {
  const clusters = await getAllClusters();
  let best = null;

  for (const c of clusters) {
    const dist = cosineDistance(embedding, c.centroid);
    if ((!best || dist < best.dist) && dist < threshold) {
      best = { cluster_id: c.id, dist };
    }
  }

  return best; // null if no match
}

/**
 * Assign multiple faces to clusters with incremental centroid update
 */
export async function assignFacesToClusters(faces) {
  if (!faces || faces.length === 0) return;

  for (const face of faces) {
    const embedding = face.normed_embedding || face.embedding;
    if (!embedding) continue;

    // 1. Find best cluster
    const best = await findBestCluster(embedding);

    let clusterId;

    if (best) {
      // Assign to existing cluster
      clusterId = best.cluster_id;
      await assignFaceToCluster(face.id, clusterId);

      // Incrementally update centroid
      await updateClusterCentroid(clusterId, embedding);

      console.log(`Face ${face.id} assigned to cluster ${clusterId} (dist=${best.dist.toFixed(4)})`);
    } else {
      // Create a new cluster with this embedding
      clusterId = await createCluster(embedding);
      await assignFaceToCluster(face.id, clusterId);

      console.log(`Created new cluster ${clusterId} for face ${face.id}`);
    }
  }
}
