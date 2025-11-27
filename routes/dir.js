import fs from "fs";
import Router from "koa-router";
import path from "path";

// Extensions you treat as images
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
    const dirents = fs.readdirSync(root, { withFileTypes: true });

    entries = dirents
      // Hide hidden folders
      .filter((e) => !e.name.startsWith("."))

      // Convert to enriched objects
      .map((e) => {
        const fullPath = path.join(root, e.name);

        // ---- 💥 IMPORTANT FIX ----
        // Never trust dirent.isDirectory() — statSync is always correct
        let isDirectory = false;
        try {
          const stat = fs.statSync(fullPath);
          isDirectory = stat.isDirectory();
        } catch {
          isDirectory = false;
        }

        if (!isDirectory) {
          return null; // file → drop
        }

        // Count items inside the directory (non-recursive)
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
          console.error("Error reading inner folder", fullPath, err);
        }

        return {
          name: e.name,
          path: fullPath,
          type: "directory",
          images: imageCount,
          subfolders: subfolderCount,
        };
      })

      // Remove nulls caused by non-directories
      .filter(Boolean);
  } catch (err) {
    console.error("ERROR reading", root, err);
  }

  ctx.body = entries;
});

export default router;
