import Koa from "koa";
import "dotenv/config";
import Router from "koa-router";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import views from "koa-views";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";

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

// Auto-load and register all routers from ./routes
async function registerRoutes(appInstance) {
  const routesDir = path.join(__dirname, "routes");
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".js"));

  // Import and mount every default export that looks like a Koa router
  for (const file of files) {
    const fullPath = path.join(routesDir, file);
    const moduleUrl = pathToFileURL(fullPath).href;
    const mod = await import(moduleUrl);
    const candidate = mod.default ?? mod.router ?? mod.routes ?? mod;

    if (candidate && typeof candidate.routes === "function" && typeof candidate.allowedMethods === "function") {
      appInstance.use(candidate.routes()).use(candidate.allowedMethods());
    }
  }
}

router.get("/upload", async (ctx) => {
  await ctx.render("upload", { active: "upload" });
});

router.get("/browse", async (ctx) => {
  await ctx.render("dir-browser", { active: "browser" });
});

// Register all routes from the routes directory
await registerRoutes(app);

app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
