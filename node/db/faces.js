import { pool } from "./index.js";
import sharp from "sharp";

const FACE_VERSION = 0.1;

export async function insertFacesIntoDB(originalBuffer, hash, faces) {
  const image = sharp(originalBuffer);
  const meta = await image.metadata();

  for (let i = 0; i < faces.length; i++) {
    console.log(faces[i]);
    const face = faces[i];
    const [x1, y1, x2, y2] = face.bbox;

    // Safe extraction bounds
    const left = Math.max(0, Math.floor(x1));
    const top = Math.max(0, Math.floor(y1));
    const width = Math.min(meta.width - left, Math.floor(x2 - x1));
    const height = Math.min(meta.height - top, Math.floor(y2 - y1));

    // Generate crop base64
    const cropBuffer = await sharp(originalBuffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 90 })
      .toBuffer();

    const cropBase64 = cropBuffer.toString("base64");

    // Insert into DB
    await pool.query(
      `
      INSERT INTO faces
      (photo_hash, face_index, bbox, landmarks, confidence, crop_base64, embedding, embedding_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        hash,
        i,
        JSON.stringify(face.bbox),
        JSON.stringify(face.landmark),
        face.det_score ?? null,
        cropBase64,
        `[${face.normed_embedding.join(",")}]`, // pgvector format
        FACE_VERSION,
      ],
    );

    console.log(`Inserted face ${i} for ${hash}`);
  }
}

export async function markPhotoScanned(hash) {
  await pool.query(`UPDATE photos SET face_scanned = $1 WHERE file_hash = $2`, [
    FACE_VERSION,
    hash,
  ]);
}
