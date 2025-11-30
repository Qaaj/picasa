import Router from "koa-router";
import fs from "fs";
import path from "path";
import { pool } from "../db/index.js";
import { loadFacesForPhoto } from "../db/faces.js";
const router = new Router();

router.get("/photo/:id", async (ctx) => {
  const id = ctx.params.id;

  const { rows } = await pool.query(`SELECT * FROM photos WHERE id=$1`, [id]);
  const faces = await loadFacesForPhoto(rows[0].file_hash);

  if (rows.length === 0) {
    ctx.throw(404, "Photo not found");
  }

  // Fetch 3 nearest neighbours based on embedding_text
  const relRes = await pool.query(
    `
  SELECT id, file_name, thumb_base64
  FROM photos
  WHERE id <> $1
  ORDER BY embedding_text <-> $2
  LIMIT 3
  `,
    [id, rows[0].embedding_text]
  );

  const related = relRes.rows;

  await ctx.render("photo-detail", { photo: rows[0], active: "photo-detail", faces, related });
});


router.get("/photo/full/:id/:filename", async (ctx) => {
  const { id } = ctx.params;

  const res = await pool.query(
    "SELECT file_path FROM photos WHERE id = $1",
    [id]
  );

  if (res.rows.length === 0) ctx.throw(404, "Photo not found");

  const absPath = res.rows[0].file_path;

  const ext = absPath.split(".").pop().toLowerCase();
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : "application/octet-stream";

  ctx.type = mime;         // <-- sets correct MIME
  // DO NOT SET Content-Disposition AT ALL

  ctx.body = fs.createReadStream(absPath);
});
export default router;
