import fetch from "node-fetch";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

import {
  insertFacesIntoDB,
  markPhotoScanned,
  checkForSimilarFaces,
} from "../db/faces.js";
import "dotenv/config";

// Ensure debug-folder exists
async function ensureDebugDir() {
  const dir = path.join(".debug-faces");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const PASSTHRU_URL = process.env.PASSTHRU;

/**
 * Process faces in an uploaded image.
 * @param {Buffer} buffer - Raw uploaded file buffer
 * @param {string} hash - Unique hash of the file (from DB or compute)
 * @returns {Object} faces, embeddings, etc.
 */
export async function processFaces(buffer, hash) {
  console.log("Processing faces for hash:", hash);

  if (!PASSTHRU_URL) {
    throw new Error("Missing PASSTHRU environment variable");
  }

  // ---- 1. Convert buffer → base64
  const base64Image = buffer.toString("base64");

  // Payload expected by passthru service
  const payload = {
    image: base64Image,
    scanFaces: true,
  };

  // ---- 2. Send to passthru (which wraps to jsonpickle)
  let json;
  try {
    const response = await fetch(PASSTHRU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    json = await response.json();
  } catch (err) {
    console.error("Error contacting passthru:", err);
    throw new Error("Face processing failed");
  }

  /*
    Expected json format (from your face server):

    {
      faces: [
        {
          bbox: [x1, y1, x2, y2],
          landmarks: [...],
          embedding: [...512 floats...]
        },
        ...
      ]
    }
  */

  if (!json.faces || json.faces.length === 0) {
    console.log("No faces detected for", hash);
    return { faces: [], count: 0 };
  }

  const faces = json.faces;
  console.log(`Detected ${faces.length} face(s) for ${hash}`);

  const debugDir = await ensureDebugDir();

  await debugSaveCrops(buffer, json.faces, hash, debugDir);
  // 3. Insert each detected face into DB

  await insertFacesIntoDB(buffer, hash, faces);
  await checkForSimilarFaces(faces);
  // 4. Mark photo as scanned with version
  await markPhotoScanned(hash);

  console.log(`Finished DB inserts for ${faces.length} faces of ${hash}`);

  // ---- 3. OPTIONAL: draw debug detection image
  // uncomment when needed
  // await drawDebugImage(buffer, faces, hash);
}

async function debugSaveCrops(originalBuffer, faces, hash, debugDir) {
  const image = sharp(originalBuffer);
  const meta = await image.metadata();

  // Generate crops
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const [x1, y1, x2, y2] = face.bbox;

    const left = Math.max(0, Math.floor(x1));
    const top = Math.max(0, Math.floor(y1));
    const width = Math.min(meta.width - left, Math.floor(x2 - x1));
    const height = Math.min(meta.height - top, Math.floor(y2 - y1));

    const outPath = path.join(debugDir, `${hash}-face${i}.jpg`);

    try {
      await sharp(originalBuffer)
        .extract({ left, top, width, height })
        .jpeg({ quality: 90 })
        .toFile(outPath);

      console.log(`Saved debug crop: ${outPath}`);
    } catch (err) {
      console.error("Crop failed:", err, {
        bbox: face.bbox,
        meta,
      });
    }
  }
}

// OPTIONAL helper – draws boxes to /debug/
async function drawDebugImage(buffer, faces, hash) {
  const tempIn = `.tmp/${hash}.jpg`;
  const tempOut = `.tmp/${hash}-detected.jpg`;

  // Write input buffer to file
  await fs.writeFile(tempIn, buffer);

  // Draw detections
  await drawDetections(tempIn, tempOut, faces);

  console.log("Debug detection drawn:", tempOut);
}
