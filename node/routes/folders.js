// routes/folder.js
import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/folder/from-photo/:photoId", async (ctx) => {
  const { photoId } = ctx.params;

  // 1. Load the reference photo
  const ref = await pool.query(
    `SELECT id, file_path FROM photos WHERE id = $1`,
    [photoId]
  );

  if (ref.rows.length === 0) {
    ctx.status = 404;
    ctx.body = "Photo not found";
    return;
  }

  const filePath = ref.rows[0].file_path;

  // Extract folder path using regex
  const folderRes = await pool.query(
    `SELECT regexp_replace($1, '/[^/]+$', '') AS folder_path`,
    [filePath]
  );

  const folderPath = folderRes.rows[0].folder_path;

  // 2. Fetch all photos in that folder
  const photosRes = await pool.query(
    `
    SELECT id, file_name, thumb_base64
    FROM photos
    WHERE file_path LIKE $1 || '/%'
    ORDER BY id
    `,
    [folderPath]
  );

  await ctx.render("folder-detail", {
    active: "folder",
    folderPath,
    photos: photosRes.rows,
    count: photosRes.rows.length,
  });
});

export default router;