// routes/clusters.js
import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/clusters", async (ctx) => {
  const res = await pool.query(`
    SELECT
      fc.id,
      fc.face_count,
      rep.crop_base64 AS sample_face
    FROM face_clusters fc
    JOIN LATERAL (
      SELECT f.crop_base64
      FROM faces f
      WHERE f.cluster_id = fc.id
      ORDER BY f.embedding <-> fc.centroid
      LIMIT 1
    ) rep ON true
    WHERE fc.ignored IS NOT TRUE
    ORDER BY fc.face_count DESC, fc.id ASC
    LIMIT 50;
  `);

  ctx.state.clusters = res.rows;
  await ctx.render("clusters", {
    active: "clusters",
    clusters: res.rows,
  });
});

router.post("/clusters/promote", async (ctx) => {
  const { name, clusterIds, personId } = ctx.request.body;

  if (!name && !personId) {
    ctx.status = 400;
    ctx.body = "Missing name or personId";
    return;
  }

  let ids = [];
  if (Array.isArray(clusterIds)) {
    ids = clusterIds.map(Number);
  } else if (typeof clusterIds === "string" || typeof clusterIds === "number") {
    ids = [Number(clusterIds)];
  }

  if (ids.length === 0 || ids.some(isNaN)) {
    ctx.status = 400;
    ctx.body = "Invalid clusterIds";
    return;
  }

  // 1. Load all embeddings from all clusters
  const vectors = [];

  function parseVec(s) {
    const inner = s.slice(1, -1);
    return inner.split(",").map(Number);
  }

  for (const clusterId of ids) {
    const facesRes = await pool.query(
      `SELECT embedding::text FROM faces WHERE cluster_id = $1`,
      [clusterId]
    );

    if (facesRes.rows.length === 0) {
      ctx.status = 404;
      ctx.body = `Cluster ${clusterId} empty`;
      return;
    }

    for (const row of facesRes.rows) {
      vectors.push(parseVec(row.embedding));
    }
  }

  // 2. Compute centroid for all vectors combined
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;

  const centroidText = `[${centroid.join(",")}]`;

  // Determine person target
  let targetPersonId;

  if (personId) {
    // Use existing person, update their identity_vector to new centroid
    await pool.query(
      `UPDATE people SET identity_vector = $1 WHERE id = $2`,
      [centroidText, personId]
    );
    targetPersonId = personId;
  } else {
    // Create a new person
    const personRes = await pool.query(
      `INSERT INTO people (name, identity_vector) VALUES ($1, $2) RETURNING id`,
      [name, centroidText]
    );
    targetPersonId = personRes.rows[0].id;
  }

  // 4. Update faces → assign to Person
  await pool.query(
    `UPDATE faces SET person_id = $1, cluster_id = NULL WHERE cluster_id = ANY($2::int[])`,
    [targetPersonId, ids]
  );

  // 5. Delete clusters
  await pool.query(
    `DELETE FROM face_clusters WHERE id = ANY($1::int[])`,
    [ids]
  );

  ctx.redirect("/clusters");
});

// Ignore multiple clusters
router.post("/clusters/ignore", async (ctx) => {
  let { clusterIds } = ctx.request.body;

  if (!clusterIds) {
    ctx.status = 400;
    ctx.body = { success: false, error: "Missing clusterIds" };
    return;
  }

  // Normalize to array of ints
  if (!Array.isArray(clusterIds)) {
    clusterIds = [clusterIds];
  }
  clusterIds = clusterIds.map((x) => parseInt(x, 10)).filter(Boolean);

  if (clusterIds.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, error: "No valid clusterIds" };
    return;
  }

  await pool.query(
    `UPDATE face_clusters SET ignored = true WHERE id = ANY($1::int[])`,
    [clusterIds]
  );
  await pool.query(
    `UPDATE faces SET ignored = true WHERE cluster_id = ANY($1::int[])`,
    [clusterIds]
  );

  ctx.body = { success: true, ignored: clusterIds.length };
});


export default router;