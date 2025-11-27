import Koa from "koa";
import "dotenv/config";
import Router from "koa-router";
import serve from "koa-static";
import views from "koa-views";
import sharp from "sharp";
import exifr from "exifr";
import path from "path";
import { fileURLToPath } from "url";
import { koaMulter } from "./middleware/upload.js";
import { annotateImage } from "./scripts/lm.js";
import { pool } from "./db/index.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();
const router = new Router();

app.use(serve(path.join(__dirname, "public")));

app.use(
  views(path.join(__dirname, "views"), {
    extension: "pug",
  }),
);

router.get("/", async (ctx) => {
  await ctx.render("index");
});

router.post("/upload", koaMulter("file"), async (ctx) => {
  const imgPath = ctx.file.path;
  const { file } = ctx;
  // exif
  const exif = await exifr.parse(imgPath).catch(() => null);

  // resized version
  const resized = await sharp(imgPath)
    .resize({ width: 200 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Thumb = `data:image/jpeg;base64,${resized.toString("base64")}`;
  // --- LM Studio annotation ---
  const annotation = await annotateImage(resized);
  const fileHash = crypto
    .createHash("sha1")
    .update(await sharp(file.path).toBuffer())
    .digest("hex");

  const result = await pool.query(
    `INSERT INTO photos (file_hash, file_name, file_path, exif, annotation)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (file_hash) DO NOTHING
      RETURNING id`,
    [fileHash, ctx.file.originalname, ctx.file.path, exif, annotation],
  );

  await ctx.render("upload-result", {
    fileName: ctx.file.originalname,
    exif,
    thumb: base64Thumb,
    annotation,
  });
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
