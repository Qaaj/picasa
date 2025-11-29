import fs from "fs";
import fetch from "node-fetch";
import sharp from "sharp";

import "dotenv/config";
import { drawDetections } from "./draw-face.js";

const IMG_PATH = "./img/test2.jpg"; // path to your image
const PASSTHRU_URL = process.env.PASSTHRU; // correct port

async function main() {
  console.log("Reading image...");
  const imgBuffer = fs.readFileSync(IMG_PATH);
  const imgB64 = imgBuffer.toString("base64");

  const payload = { image: imgB64 };

  console.log("Sending to passthru…");
  const response = await fetch(PASSTHRU_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  console.log(JSON.stringify(json, null, 2));

  const faces = json.faces;
  console.log(faces.length, "Faces Detected");

  if (!faces || faces.length === 0) {
    console.log("No faces detected.");
    return;
  }

  await drawDetections(IMG_PATH, "./img/detected.jpg", json.faces);

  // -------
  // DRAW BOXES
  // -------
}

main().catch(console.error);
