import fs from "fs";
import Router from "koa-router";
import path from "path";

// Image extensions counted
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif"]);

const router = new Router();

router.get("/dir", async (ctx) => {
  const root = ctx.query.path;

  if (!root || !fs.existsSync(root)) {
    ctx.body = [];
    return;
  }

  let entries = [];

  try {
    // Try to read folder
    const dirents = fs.readdirSync(root, { withFileTypes: true });

    entries = dirents
      // remove hidden
      .filter((e) => !e.name.startsWith("."))

      .map((e) => {
        const fullPath = path.join(root, e.name);

        // 🔥 Always resolve real path + stat instead of trusting dirent
        let isDirectory = false;
        let error = null;

        try {
          const stat = fs.statSync(fullPath); // follows symlink
          isDirectory = stat.isDirectory();
        } catch (err) {
          // e.g. macOS TCC permission denied
          error = err;
          isDirectory = false;
        }

        if (!isDirectory) {
          return null; // hide files completely
        }

        // 🔥 Count images + subfolders inside directory
        let subfolderCount = 0;
        let imageCount = 0;

        try {
          const inner = fs.readdirSync(fullPath, { withFileTypes: true });

          for (const item of inner) {
            if (item.isDirectory()) {
              subfolderCount++;
            } else {
              const ext = path.extname(item.name).toLowerCase();
              if (IMAGE_EXT.has(ext)) imageCount++;
            }
          }
        } catch (err) {
          // 🔥 FE will show unreadable folders instead of pretending they are empty
          error = err;
        }

        return {
          name: e.name,
          path: fullPath,
          type: "directory",
          subfolders: subfolderCount,
          images: imageCount,
          readable: error ? false : true, // 👈 FE can use this
          error: error ? error.message : null, // 👈 debug info
        };
      })

      .filter(Boolean);
  } catch (err) {
    console.error("ERROR reading", root, err);
    ctx.body = [];
    return;
  }

  ctx.body = entries;
});

export default router;
