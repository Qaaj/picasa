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
import { inferExtraMetadata } from "../helpers/infer-extra.js";
import { enqueue } from "./jobQueue.js";
import { processFaces } from "./processFaces.js";

export async function processImage(
  { filePath, originalName = null, fileBuffer = null },
  scanFaces = false,
) {
  const stats = fs.statSync(filePath);

  const fsCreatedAt = stats.birthtime ?? null;
  const fsModifiedAt = stats.mtime ?? null;

  if (!fileBuffer) {
    fileBuffer = await sharp(filePath).toBuffer();
  }

  // -------------------------
  // 1. Hash + dedup
  // -------------------------
  const fileHash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

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
  // 3. Kick off LM Studio ASAP
  // -------------------------
  const annotationPromise = annotateImage(thumbBuffer);

  // -------------------------
  // 4. EXIF + meta
  // -------------------------
  const exifRaw = await exifr.parse(filePath).catch(() => null);
  const meta = extractStructuredExif(exifRaw);

  // -------------------------
  // 5. INSERT photo immediately (no annotation/embedding yet)
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
       thumb_base64,
       fs_created_at,
       fs_modified_at
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
       $19,
       $20,
       $21
     )
     RETURNING id;
     `,
    [
      fileHash,
      originalName || filePath.split("/").pop(),
      filePath,
      exifRaw,
      null, // annotation (filled later)
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
      null, // embedding_text (filled later)
      base64Thumb,
      fsCreatedAt,
      fsModifiedAt,
    ],
  );

  const photoId = insert.rows[0].id;

  // -------------------------
  // 6. Kick off face recognition asynchronously (FK-safe now)
  // -------------------------
  if (scanFaces) {
    enqueue(async () => {
      await processFaces(fileBuffer, fileHash);
    });
  }

  // -------------------------
  // 7. Wait for LM Studio + build embedding
  // -------------------------
  const annotation = await annotationPromise;
  const imageMeta = await sharp(filePath).metadata();
  const extra = inferExtraMetadata({
    annotation,
    originalname: originalName,
    exif: exifRaw, // full EXIF object from exifr
    meta: meta, // your structured EXIF
    path: filePath,
    imageMeta,
  });

  const annotationFinal = {
    ...annotation,
    tags: Array.from(
      new Set([...(annotation?.tags || []), ...(extra.tags || [])]),
    ),
  };

  const textForEmbedding = buildTextEmbeddingInput({
    file: { originalname: originalName, path: filePath },
    meta,
    exif: exifRaw,
    annotation: annotationFinal,
  });

  const embeddingText = await embedText(textForEmbedding);
  const embeddingTextPg = toPgVector(embeddingText);

  // -------------------------
  // 8. UPDATE photo with annotation + embedding
  // -------------------------
  await pool.query(
    `
      UPDATE photos
      SET annotation = $2,
          embedding_text = $3
      WHERE file_hash = $1
    `,
    [fileHash, annotationFinal, embeddingTextPg],
  );

  // -------------------------
  // 9. Return to FE
  // -------------------------
  return {
    id: photoId,
    hash: fileHash,
    skipped: false,
    exifRaw,
    meta,
    annotation: annotationFinal,
    embeddingText,
    thumb: base64Thumb,
  };
}
