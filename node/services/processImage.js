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
  const stats = fs.statSync(filePath); // filePath = absolute path to file

  const fsCreatedAt = stats.birthtime ?? null; // macOS, Linux
  const fsModifiedAt = stats.mtime ?? null;

  if (!fileBuffer) {
    fileBuffer = await sharp(filePath).toBuffer();
  }

  // -------------------------
  // 1. Hash
  // -------------------------
  const fileHash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

  console.log("SCAN FACES?", scanFaces);
  if (scanFaces) {
    enqueue(async () => {
      await processFaces(fileBuffer, fileHash);
    });
  }
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

  console.log({ originalname: originalName, path: filePath });
  const extra = inferExtraMetadata({
    annotation,
    originalname: originalName,
    path: filePath,
  });

  console.log("_----------------__");
  console.log(extra);

  const annotationFinal = {
    ...annotation,
    tags: Array.from(
      new Set([...(annotation?.tags || []), ...(extra.tags || [])]),
    ),
  };
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
      annotationFinal,
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
      fsCreatedAt,
      fsModifiedAt,
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
