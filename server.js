import Koa from "koa";
import "dotenv/config";
import Router from "koa-router";
import serve from "koa-static";
import views from "koa-views";
import path from "path";
import { fileURLToPath } from "url";

import uploadRoutes from "./routes/upload.js";
import dirRouter from "./routes/dir.js";

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

router.get("/browse", async (ctx) => {
  await ctx.render("dir-browser");
});

app.use(uploadRoutes.routes()).use(uploadRoutes.allowedMethods());
app.use(dirRouter.routes()).use(dirRouter.allowedMethods());
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
