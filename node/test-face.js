import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Converts '[0.1,0.2,...]' to [0.1,0.2,...]
function parseVec(t) {
  const inner = t.slice(1, -1); // remove brackets
  return inner.split(",").map(Number);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function normalize(a) {
  const n = norm(a);
  return a.map((v) => v / n);
}

function cosineDistance(a, b) {
  const na = norm(a);
  const nb = norm(b);
  const cosSim = dot(a, b) / (na * nb);
  return 1 - cosSim;
}

async function main() {
  // Fetch only IDs 8,9,10
  const res = await pool.query(`
    SELECT id, embedding::text AS emb_text
    FROM faces
    WHERE id IN (8, 9, 10)
    ORDER BY id;
  `);

  const vectors = res.rows.map((r) => ({
    id: r.id,
    vec: parseVec(r.emb_text),
  }));

  console.log(
    "Loaded embeddings:",
    vectors.map((v) => v.id),
  );

  // --- Compute golden vector (mean of the three) ---
  const dim = vectors[0].vec.length;
  const sum = new Array(dim).fill(0);

  for (const { vec } of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }

  const mean = sum.map((v) => v / vectors.length);
  const golden = normalize(mean);

  console.log("\nGolden vector ready.");

  // --- Compare each original vector to golden ---
  console.log("\nCosine distances vs Golden Vector:");
  for (const { id, vec } of vectors) {
    const dist = cosineDistance(vec, golden);
    console.log(`  id=${id}   dist=${dist.toFixed(6)}`);
  }

  await pool.end();
}

main();
