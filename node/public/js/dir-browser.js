import fs from "fs";
import path from "path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif"]);

router.get("/dir", async (ctx) => {
  const folderPath = ctx.query.path;
  if (!folderPath || !fs.existsSync(folderPath)) {
    ctx.body = [];
    return;
  }

  let items = [];

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    items = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".")) // *** ONLY DIRECTORIES ***
      .map((e) => {
        const full = path.join(folderPath, e.name);

        let subfolders = 0;
        let images = 0;

        // look inside to count
        const inner = fs.readdirSync(full, { withFileTypes: true });
        for (const i of inner) {
          if (i.isDirectory()) subfolders++;
          else {
            const ext = path.extname(i.name).toLowerCase();
            if (IMAGE_EXT.has(ext)) images++;
          }
        }

        return {
          name: e.name,
          path: full,
          subfolders,
          images,
        };
      });
  } catch (err) {
    console.error(err);
  }

  ctx.body = items;
});
