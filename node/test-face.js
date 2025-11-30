import "dotenv/config";
import { pool } from "./db/index.js";
import { toPgVector } from "./helpers/vector.js";

function parseEmbedding(raw) {
  // If pg returns a native array of numbers (ideal case)
  if (Array.isArray(raw)) {
    return raw.map(Number);
  }

  // If pg returns a string representation (e.g. "[0.1,0.2,...]" or "{0.1,0.2,...}")
  if (typeof raw === "string") {
    const inner = raw.replace(/[{}\[\]\s]/g, "");
    if (!inner) return [];
    return inner.split(",").map(Number);
  }

  throw new Error("Unsupported embedding format: " + String(raw));
}

async function rebuildGoldenVectors() {
  const people = await pool.query(`SELECT id FROM people`);

  for (const p of people.rows) {
    const faces = await pool.query(
      `SELECT embedding FROM faces WHERE person_id = $1`,
      [p.id]
    );

    if (faces.rows.length === 0) {
      console.log(`Person ${p.id}: no faces, skipping`);
      continue;
    }

    // Convert pgvector -> JS numeric arrays
    let vecs = faces.rows.map((r) => parseEmbedding(r.embedding));

    // Filter out empty / invalid vectors
    vecs = vecs.filter(
      (v) => Array.isArray(v) && v.length > 0 && v.every((n) => Number.isFinite(n))
    );

    if (vecs.length === 0) {
      console.log(`Person ${p.id}: all embeddings invalid, skipping`);
      continue;
    }

    // Ensure consistent dimensionality
    const dim = vecs[0].length;
    vecs = vecs.filter((v) => v.length === dim);

    if (vecs.length === 0) {
      console.log(`Person ${p.id}: no embeddings with consistent dimension, skipping`);
      continue;
    }

    // Average elementwise
    const avg = new Array(dim).fill(0);

    for (const v of vecs) {
      for (let i = 0; i < dim; i++) {
        avg[i] += v[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      avg[i] /= vecs.length;
    }

    // Write the averaged vector as a raw JS array
    await pool.query(
      `UPDATE people SET identity_vector = $1 WHERE id = $2`,
      [avg, p.id]
    );

    console.log(`Rebuilt golden vector for person ${p.id} from ${vecs.length} faces`);
  }
}

rebuildGoldenVectors().then(() => {
  console.log("Done rebuilding golden vectors");
  process.exit(0);
}).catch((err) => {
  console.error("Error rebuilding golden vectors", err);
  process.exit(1);
});