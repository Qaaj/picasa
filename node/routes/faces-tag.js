import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.post("/faces/tag", async (ctx) => {
  const { name, faceIds } = ctx.request.body;

  if (!name || !Array.isArray(faceIds) || faceIds.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "Missing name or face IDs" };
    return;
  }

  // 1. Does person already exist?
  let person = await pool.query("SELECT id FROM people WHERE name = $1", [
    name,
  ]);

  let personId;
  if (person.rows.length === 0) {
    // Create new person
    const created = await pool.query(
      `INSERT INTO people (name) VALUES ($1) RETURNING id`,
      [name],
    );
    personId = created.rows[0].id;
  } else {
    personId = person.rows[0].id;
  }

  // 2. Assign faces
  await pool.query(
    `UPDATE faces SET person_id = $1 WHERE id = ANY($2::int[])`,
    [personId, faceIds],
  );

  // 3. Recompute identity vector
  await recomputeIdentityVector(personId);

  ctx.body = {
    success: true,
    personId,
  };
});

export default router;

// Helper to recompute golden vector
async function recomputeIdentityVector(personId) {
  // Get all embeddings for this person
  const res = await pool.query(
    `
    SELECT embedding::text AS emb
    FROM faces
    WHERE person_id = $1
  `,
    [personId],
  );

  if (res.rows.length === 0) return;

  // Convert '[0.1,0.2,...]' → [0.1,0.2,...]
  const parseVec = (t) => {
    const inner = t.slice(1, -1);
    return inner.split(",").map(Number);
  };

  const vectors = res.rows.map((r) => parseVec(r.emb));
  const dim = vectors[0].length;

  // Compute mean vector
  const sum = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += vec[i];
  }
  const mean = sum.map((v) => v / vectors.length);

  // Normalize
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0));
  const normalized = mean.map((v) => v / norm);

  // Save to DB
  await pool.query(`UPDATE people SET identity_vector = $1 WHERE id = $2`, [
    `[${normalized.join(",")}]`,
    personId,
  ]);
}
