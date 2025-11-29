import fs from "fs";
import sharp from "sharp";

/**
 * Draw detection results on an image using a single SVG overlay.
 */
export async function drawDetections(inputPath, outputPath, faces) {
  let img = sharp(inputPath).rotate();

  const metadata = await img.metadata();

  const { width, height } = metadata;

  const shapes = faces
    .map((face) => {
      const [x1, y1, x2, y2] = face.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      const landmarks = face.landmark
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="red" />`)
        .join("\n");

      return `
            <rect x="${x1}" y="${y1}" width="${w}" height="${h}"
                  fill="none" stroke="lime" stroke-width="8" />
            ${landmarks}
        `;
    })
    .join("\n");

  const svg = `
        <svg width="${width}" height="${height}"
             xmlns="http://www.w3.org/2000/svg">
            ${shapes}
        </svg>
    `;

  const svgBuffer = Buffer.from(svg);

  await sharp(inputPath)
    .composite([{ input: svgBuffer, blend: "over" }])
    .toFile(outputPath);

  console.log("Saved:", outputPath);
}
