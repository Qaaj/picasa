import Router from "koa-router";
import {pool} from "../db/index.js";

const router = new Router();

// GET /albums — list all albums
router.get("/albums", async (ctx) => {
  const res = await pool.query(`
    SELECT 
      a.id,
      a.name,
      a.created_at,
      COUNT(ap.photo_id) AS photo_count
    FROM albums a
    LEFT JOIN album_photos ap ON ap.album_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `);

  await ctx.render("albums", { albums: res.rows });
});

// GET /albums/:id — album detail (show all photos)
router.get("/albums/:id", async (ctx) => {
  const albumId = parseInt(ctx.params.id, 10);

  const albumRes = await pool.query(
    `SELECT id, name, created_at FROM albums WHERE id = $1`,
    [albumId]
  );
  if (albumRes.rowCount === 0) {
    ctx.status = 404;
    ctx.body = "Album not found";
    return;
  }

  const photosRes = await pool.query(
    `
      SELECT p.id, p.thumb_base64, p.file_name
      FROM album_photos ap
      JOIN photos p ON p.id = ap.photo_id
      WHERE ap.album_id = $1
      ORDER BY p.created_at ASC
    `,
    [albumId]
  );

  await ctx.render("album-detail", {
    album: albumRes.rows[0],
    photos: photosRes.rows
  });
});

// POST /albums/create — create a new album (optionally with photoIds)
router.post("/albums/create", async (ctx) => {
  const { name, photoIds } = ctx.request.body;

  if (!name || name.trim() === "") {
    ctx.status = 400;
    ctx.body = { error: "Album name required" };
    return;
  }

  // 1. Create album
  const res = await pool.query(
    `INSERT INTO albums (name, created_at) VALUES ($1, NOW()) RETURNING id`,
    [name.trim()]
  );

  const albumId = res.rows[0].id;

  // 2. Optionally add photos
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    const values = photoIds.map((pid) => `(${albumId}, ${pid})`).join(",");
    await pool.query(`
      INSERT INTO album_photos (album_id, photo_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `);
  }

  ctx.body = { success: true, albumId };
});

// POST /albums/add — add photoIds[] to albumId
router.post("/albums/add", async (ctx) => {
  const { albumId, photoIds } = ctx.request.body;

  if (!albumId || !Array.isArray(photoIds) || photoIds.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "albumId and photoIds[] required" };
    return;
  }

  const values = photoIds.map((pid) => `(${albumId}, ${pid})`).join(",");

  await pool.query(`
    INSERT INTO album_photos (album_id, photo_id)
    VALUES ${values}
    ON CONFLICT DO NOTHING
  `);

  ctx.body = { success: true };
});

// POST /albums/remove — remove photos from an album
router.post("/albums/remove", async (ctx) => {
  //

  let { albumId, photoIds } = ctx.request.body;
  console.log(ctx.request.body)
  if (!albumId || !photoIds) {
    ctx.status = 400;
    ctx.body = { error: "albumId and photoIds[] required" };
    return;
  }

  if (!Array.isArray(photoIds)) {
    photoIds = [photoIds];
  }

  console.log(photoIds);
  photoIds = photoIds.map(Number).filter(n => !isNaN(n));
  if (photoIds.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "albumId and photoIds[] required" };
    return;
  }
  //

  await pool.query(
    `DELETE FROM album_photos WHERE album_id = $1 AND photo_id = ANY($2::int[])`,
    [albumId, photoIds]
  );

  ctx.body = { success: true };
});

export default router;