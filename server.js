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
import { embedText } from "./services/textEmbed.js";
import { extractStructuredExif } from "./helpers/exif.js";
import { buildTextEmbeddingInput } from "./helpers/text-embedding-input.js";
import { pool } from "./db/index.js";
import crypto from "crypto";
import { toPgVector } from "./helpers/vector.js";

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

  // 1) Read buffer + hash once
  const fileBuffer = await sharp(file.path).toBuffer();

  const fileHash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

  // 2) De-dupe before we do any expensive LM calls
  const existing = await pool.query(
    "SELECT id FROM photos WHERE file_hash = $1",
    [fileHash],
  );

  console.log(file);

  if (existing.rows.length > 0) {
    await ctx.render("upload-result", {
      fileName: file.originalname,
      isDuplicate: true,
      id: existing.rows[0].id,
      exif: null,
      annotation: null,
      thumb: null,
    });
    return;
  }

  // 3) Thumbnail (needed for FE no matter what)
  const thumbBuffer = await sharp(fileBuffer)
    .resize({ width: 600 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Thumb = `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;

  // 4) Things that can run in parallel: EXIF + annotation
  const exifPromise = exifr.parse(file.path).catch(() => null);
  const annotationPromise = annotateImage(thumbBuffer); // your LM Studio vision call

  const [exifRaw, annotation] = await Promise.all([
    exifPromise,
    annotationPromise,
  ]);

  const meta = extractStructuredExif(exifRaw);

  // 5) Now build the text for embedding (depends on exif + annotation)
  const textForEmbedding = buildTextEmbeddingInput({
    file,
    meta,
    exif: exifRaw,
    annotation,
  });

  // 6) Single await for text embedding
  const embeddingText = await embedText(textForEmbedding);

  const embeddingTextPg = toPgVector(embeddingText);
  // const embeddingImagePg = toPgVector(embeddingImage);

  // 7) Insert into DB (including new embedding_text column)
  const insert = await pool.query(
    `
     INSERT INTO photos (
       file_hash,
       file_name,
       file_path,
       exif,
       annotation,
       location_point,
       location_metadata,
       gps_altitude,
       taken_at,
       camera_make,
       camera_model,
       lens,
       focal_length,
       iso,
       exposure_time,
       aperture,
       device_type,
       embedding_text
     )
     VALUES (
       $1,$2,$3,
       $4,$5,
       $6,$7,
       $8,$9,
       $10,$11,$12,
       $13,$14,$15,$16,
       $17,
       $18
     )
     RETURNING id;
     `,
    [
      fileHash,
      file.originalname,
      file.path,
      exifRaw,
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
      embeddingTextPg,
    ],
  );

  const id = insert.rows[0].id;

  // 8) Render the result page instead of JSON
  await ctx.render("upload-result", {
    fileName: file.originalname,
    exif: exifRaw,
    annotation,
    thumb: base64Thumb,
    id,
    isDuplicate: false,
  });
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
