import Router from "koa-router";
import fs from "fs";
import path from "path";
import { processImage } from "../services/processImage.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif"]);
const router = new Router();

router.post("/scan-folder", async (ctx) => {
  console.log(ctx.request.body);
  const folder = ctx.request.body.folder;
  const files = fs.readdirSync(folder, { withFileTypes: true });

  const images = files.filter(
    (f) => f.isFile() && IMAGE_EXT.has(path.extname(f.name).toLowerCase()),
  );

  let inserted = 0;
  let skipped = 0;

  for (const f of images) {
    const fullPath = path.join(folder, f.name);

    const result = await processImage({
      filePath: fullPath,
      originalName: f.name,
    });

    if (result.skipped) skipped++;
    else inserted++;
  }

  ctx.body = {
    folder,
    total: images.length,
    inserted,
    skipped,
  };
});

export default router;
