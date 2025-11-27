import Koa from "koa";
import "dotenv/config";
import Router from "koa-router";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import views from "koa-views";
import path from "path";
import { fileURLToPath } from "url";

import uploadRoutes from "./routes/upload.js";
import dirRouter from "./routes/dir.js";
import statusRouter from "./routes/scan-status.js";
import scanFolder from "./routes/scan.js";
import dashboardRouter from "./routes/dashboard.js";
import photoDetail from "./routes/photo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();
app.use(bodyParser()); // <<< THIS MUST COME BEFORE ROUTES
const router = new Router();

app.use(serve(path.join(__dirname, "public")));

app.use(
  views(path.join(__dirname, "views"), {
    extension: "pug",
  }),
);

router.get("/upload", async (ctx) => {
  await ctx.render("upload", { active: "upload" });
});

router.get("/browse", async (ctx) => {
  await ctx.render("dir-browser", { active: "browser" });
});

app.use(dashboardRouter.routes());
app.use(uploadRoutes.routes()).use(uploadRoutes.allowedMethods());
app.use(dirRouter.routes()).use(dirRouter.allowedMethods());
app.use(statusRouter.routes()).use(statusRouter.allowedMethods());
app.use(scanFolder.routes()).use(scanFolder.allowedMethods());
app.use(photoDetail.routes()).use(photoDetail.allowedMethods());

app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
