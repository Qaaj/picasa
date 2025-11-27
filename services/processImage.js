import fs from "fs";
import sharp from "sharp";
import crypto from "crypto";
import exifr from "exifr";

import { annotateImage } from "../scripts/lm.js";
import { embedText } from "../services/textEmbed.js";
import { extractStructuredExif } from "../helpers/exif.js";
import { buildTextEmbeddingInput } from "../helpers/text-embedding-input.js";
import { pool } from "../db/index.js";
import { toPgVector } from "../helpers/vector.js";

export async function processImage({
  filePath,
  originalName = null,
  fileBuffer = null,
}) {
  if (!fileBuffer) {
    fileBuffer = await sharp(filePath).toBuffer();
  }

  // -------------------------
  // 1. Hash
  // -------------------------
  const fileHash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

  // Dedup
  const existing = await pool.query(
    "SELECT id FROM photos WHERE file_hash = $1",
    [fileHash],
  );

  if (existing.rows.length > 0) {
    return {
      id: existing.rows[0].id,
      skipped: true,
      hash: fileHash,
    };
  }

  // -------------------------
  // 2. Thumbnail
  // -------------------------
  const thumbBuffer = await sharp(fileBuffer)
    .resize({ width: 600 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Thumb = `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;

  // -------------------------
  // 3. EXIF + annotation (parallel)
  // -------------------------
  const exifPromise = exifr.parse(filePath).catch(() => null);
  const annotationPromise = annotateImage(thumbBuffer);

  const [exifRaw, annotation] = await Promise.all([
    exifPromise,
    annotationPromise,
  ]);

  const meta = extractStructuredExif(exifRaw);

  // -------------------------
  // 4. Embedding text
  // -------------------------
  const textForEmbedding = buildTextEmbeddingInput({
    file: { originalname: originalName, path: filePath },
    meta,
    exif: exifRaw,
    annotation,
  });

  const embeddingText = await embedText(textForEmbedding);
  const embeddingTextPg = toPgVector(embeddingText);

  // -------------------------
  // 5. Insert into DB
  // -------------------------
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
       embedding_text,
       thumb_base64
     )
     VALUES (
       $1,$2,$3,
       $4,$5,
       $6,$7,
       $8,$9,
       $10,$11,$12,
       $13,$14,$15,$16,
       $17,
       $18,
       $19
     )
     RETURNING id;
     `,
    [
      fileHash,
      originalName || filePath.split("/").pop(),
      filePath,
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
      base64Thumb,
    ],
  );

  return {
    id: insert.rows[0].id,
    hash: fileHash,
    skipped: false,
    exifRaw,
    meta,
    annotation,
    embeddingText,
    thumb: base64Thumb,
  };
}
