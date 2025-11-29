import Router from "koa-router";
import { pool } from "../db/index.js"; // adjust path to your db.js
import fs from "fs";
import path from "path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif"]);

const router = new Router();

router.get("/scan-status", async (ctx) => {
  console.log(ctx.query);
  const folder = ctx.query.path;
  if (!folder || !fs.existsSync(folder)) {
    ctx.body = { error: "Invalid folder" };
    return;
  }

  // 1. Count image files in folder
  let totalFiles = 0;
  try {
    const items = fs.readdirSync(folder, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (IMAGE_EXT.has(ext)) totalFiles++;
      }
    }
  } catch (err) {
    console.error("scan-status fs error:", err);
  }

  // 2. Count DB entries for this folder
  const result = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM photos
      WHERE file_path LIKE $1 || '/%'
    `,
    [folder],
  );

  const dbCount = parseInt(result.rows[0].count, 10);

  // 3. Comparison response
  ctx.body = {
    folder,
    total_files: totalFiles,
    db_entries: dbCount,
    remaining: Math.max(totalFiles - dbCount, 0),
    is_complete: dbCount >= totalFiles,
  };
});

export default router;
