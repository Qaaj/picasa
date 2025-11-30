import Router from "koa-router";
import { koaMulter } from "../middleware/upload.js";
import { processImage } from "../services/processImage.js";

const router = new Router();

router.post("/upload", koaMulter("file"), async (ctx) => {
  const file = ctx.file;

  const parseFaces = ctx.req.body?.scanFaces;

  const result = await processImage(
    {
      filePath: file.path,
      originalName: file.originalname,
    },
    parseFaces,
  );

  ctx.redirect(`/photo/${result.id}`);
});

export default router;
