import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/faces", async (ctx) => {
  // Query params
  const page = parseInt(ctx.query.page || "1", 10);
  const pageSize = 60;              // You can change this if needed
  const offset = (page - 1) * pageSize;

  // Get total count (ignored = false)
  const totalRes = await pool.query(`
    SELECT COUNT(*) AS count
    FROM faces
    WHERE ignored = false
  `);
  const totalCount = parseInt(totalRes.rows[0].count, 10);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Get the actual rows
  const facesRes = await pool.query(
    `
    SELECT f.id, f.crop_base64, f.person_id, p.name AS person_name
    FROM faces f
    LEFT JOIN people p ON p.id = f.person_id
    WHERE f.ignored = false
    ORDER BY f.id DESC
    LIMIT $1 OFFSET $2
    `,
    [pageSize, offset]
  );

  await ctx.render("faces", {
    faces: facesRes.rows,
    page,
    totalPages,
    pageSize,
    active: "faces",
  });
});

// Ignore multiple faces
router.post("/faces/ignore", async (ctx) => {
  let { faceIds } = ctx.request.body;

  if (!faceIds) {
    ctx.status = 400;
    ctx.body = { success: false, error: "Missing faceIds" };
    return;
  }

  // Normalize to array of ints
  if (!Array.isArray(faceIds)) {
    faceIds = [faceIds];
  }
  faceIds = faceIds.map((x) => parseInt(x, 10)).filter(Boolean);

  if (faceIds.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, error: "No valid faceIds" };
    return;
  }

  await pool.query(
    `UPDATE faces SET ignored = true WHERE id = ANY($1::int[])`,
    [faceIds]
  );

  ctx.body = { success: true, ignored: faceIds.length };
});
// DELETE /faces/:id
router.delete('/faces/:id', async (ctx) => {
  const faceId = Number(ctx.params.id);
  if (!faceId) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid face id' };
    return;
  }

  try {
    await pool.query('BEGIN');

    // Delete face (clusters handled elsewhere or via FK rules)
    const res = await pool.query(
      'DELETE FROM faces WHERE id = $1',
      [faceId]
    );

    if (res.rowCount === 0) {
      throw new Error('Face not found');
    }

    await pool.query('COMMIT');
    ctx.body = { success: true };
  } catch (err) {
    await pool.query('ROLLBACK');
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});
export default router;
