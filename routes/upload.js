import Router from "koa-router";
import { koaMulter } from "../middleware/upload.js";
import { processImage } from "../services/processImage.js";

const router = new Router();

router.post("/upload", koaMulter("file"), async (ctx) => {
  const file = ctx.file;

  const result = await processImage({
    filePath: file.path,
    originalName: file.originalname,
  });

  await ctx.render("upload-result", {
    fileName: file.originalname,
    isDuplicate: result.skipped,
    id: result.id,
    exif: result.exifRaw || null,
    annotation: result.annotation || null,
    thumb: result.thumb || null,
  });
});

export default router;
