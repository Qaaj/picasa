import Koa from "koa";
import "dotenv/config";
import Router from "koa-router";
import serve from "koa-static";
import views from "koa-views";
import sharp from "sharp";
import exifr from "exifr";
import path from "path";
import { fileURLToPath } from "url";
import { koaMulter } from "./middleware/upload.js";
import { annotateImage } from "./scripts/lm.js";
import { extractStructuredExif } from "./helpers/exif.js";

import { pool } from "./db/index.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();
const router = new Router();

app.use(serve(path.join(__dirname, "public")));

app.use(
  views(path.join(__dirname, "views"), {
    extension: "pug",
  }),
);

router.get("/", async (ctx) => {
  await ctx.render("index");
});

router.post("/upload", koaMulter("file"), async (ctx) => {
  const file = ctx.file;
  if (!file) {
    ctx.throw(400, "No file uploaded");
    return;
  }

  // read full buffer for hashing
  const fileBuffer = await sharp(file.path).toBuffer();

  const fileHash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

  // check dedupe
  const exists = await pool.query(
    "SELECT id FROM photos WHERE file_hash = $1",
    [fileHash],
  );

  if (exists.rows.length > 0) {
    ctx.body = {
      status: "duplicate",
      id: exists.rows[0].id,
    };
    return;
  }

  // EXIF parse (may fail, so catch)
  const exif = await exifr.parse(file.path).catch(() => null);
  const meta = extractStructuredExif(exif);

  // Thumbnail
  const thumb = await sharp(file.path)
    .resize({ width: 600 })
    .jpeg({ quality: 80 })
    .toBuffer();
  const base64Thumb = `data:image/jpeg;base64,${thumb.toString("base64")}`;

  // Vision annotation
  const annotation = await annotateImage(thumb);

  // DB insert
  const insert = await pool.query(
    `
    INSERT INTO photos (
      file_hash, file_name, file_path,
      exif, annotation,

      location_point, location_metadata,
      gps_altitude, taken_at,
      camera_make, camera_model, lens,
      focal_length, iso, exposure_time, aperture,
      device_type
    )
    VALUES (
      $1,$2,$3,
      $4,$5,

      $6,$7,
      $8,$9,
      $10,$11,$12,
      $13,$14,$15,$16,
      $17
    )
    RETURNING id;
    `,
    [
      fileHash,
      file.originalname,
      file.path,

      exif,
      annotation,

      meta.location_point,
      meta.location_metadata,
      meta.gps_altitude,
      meta.taken_at,
      meta.camera_make,
      meta.camera_model,
      meta.lens,
      meta.focal_length,
      meta.iso,
      meta.exposure_time,
      meta.aperture,
      meta.device_type,
    ],
  );
  console.log("RAW EXIF:", exif);
  await ctx.render("upload-result", {
    fileName: ctx.file.originalname,
    exif,
    thumb: base64Thumb,
    annotation,
    meta,
  });
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
