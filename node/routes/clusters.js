// routes/clusters.js
import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/clusters", async (ctx) => {
  const res = await pool.query(`
    SELECT
      fc.id,
      fc.face_count,
      MIN(f.crop_base64) AS sample_face
    FROM face_clusters fc
    JOIN faces f ON f.cluster_id = fc.id
    GROUP BY fc.id, fc.face_count
    ORDER BY fc.id;
  `);

  ctx.state.clusters = res.rows;
  await ctx.render("clusters", {
    active: "clusters",
    clusters: res.rows,
  });
});

router.post("/clusters/:id/promote", async (ctx) => {
  const clusterId = Number(ctx.params.id);
  const { name } = ctx.request.body;

  if (!name) {
    ctx.status = 400;
    ctx.body = "Missing name";
    return;
  }

  // 1. Load all embeddings in cluster
  const facesRes = await pool.query(
    `SELECT id, embedding::text FROM faces WHERE cluster_id = $1`,
    [clusterId]
  );

  if (facesRes.rows.length === 0) {
    ctx.status = 404;
    ctx.body = "Cluster empty";
    return;
  }

  // 2. Compute golden vector for new Person
  function parseVec(s) {
    const inner = s.slice(1, -1);
    return inner.split(",").map(Number);
  }

  const vectors = facesRes.rows.map((f) => parseVec(f.embedding));

  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;

  const centroidText = `[${centroid.join(",")}]`;

  // 3. Create Person
  const personRes = await pool.query(
    `INSERT INTO people (name, identity_vector) VALUES ($1, $2) RETURNING id`,
    [name, centroidText]
  );
  const personId = personRes.rows[0].id;

  // 4. Update faces → assign to Person
  await pool.query(
    `UPDATE faces SET person_id = $1, cluster_id = NULL WHERE cluster_id = $2`,
    [personId, clusterId]
  );

  // 5. Delete cluster
  await pool.query(`DELETE FROM face_clusters WHERE id = $1`, [clusterId]);

  ctx.redirect("/clusters");
});

export default router;