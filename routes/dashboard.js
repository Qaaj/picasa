import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/dashboard", async (ctx) => {
  const page = parseInt(ctx.query.page || "1", 10);
  const pageSize = 100; // adjust if needed
  const offset = (page - 1) * pageSize;

  const { rows } = await pool.query(
    `
    SELECT id, file_name, file_path, thumb_base64, taken_at, fs_created_at
    FROM photos
    ORDER BY id DESC
    LIMIT $1 OFFSET $2
    `,
    [pageSize, offset],
  );

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM photos`);
  const total = parseInt(countRows[0].count, 10);
  const totalPages = Math.ceil(total / pageSize);

  await ctx.render("dashboard", {
    photos: rows,
    page,
    totalPages,
  });
});

export default router;
