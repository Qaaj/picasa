import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

// Render search page (no tags)
router.get("/tags", async ctx => {
  await ctx.render("tags", { });
});

// Autocomplete API
router.post("/tags/search", async (ctx) => {
  const q = ctx.request.body.query || "";

  const res = await pool.query(
    `
        SELECT DISTINCT t.tag
        FROM (
                 SELECT jsonb_array_elements_text(annotation->'tags') AS tag
                 FROM photos
             ) AS t
        WHERE t.tag ILIKE $1
        ORDER BY t.tag ASC
    `,
    [`%${q}%`]
  );

  ctx.body = { tags: res.rows.map((r) => r.tag) };
});

// Multi-tag filter API: return photos that contain ALL selected tags
router.post("/tags/filter", async (ctx) => {
  const { tags } = ctx.request.body;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    ctx.body = { photos: [] };
    return;
  }

  // Each tag must exist inside annotation->'tags'
  const conditions = tags.map((_, i) => `annotation->'tags' ? $${i + 1}`).join(" AND ");

  const params = tags;

  const res = await pool.query(
    `
      SELECT id, file_name, thumb_base64
      FROM photos
      WHERE ${conditions}
      ORDER BY taken_at DESC NULLS LAST
    `,
    params
  );

  ctx.body = { photos: res.rows };
});

// Photos for a tag
// /tags/:tag → photos for a tag
router.get("/tags/:tag", async (ctx) => {
  const tag = ctx.params.tag;

  const photos = await pool.query(`
      SELECT id, file_name, thumb_base64
      FROM photos
      WHERE annotation->'tags' ? $1
      ORDER BY taken_at DESC NULLS LAST
  `, [tag]);

  await ctx.render("tag-detail", {
    tag,
    photos: photos.rows,
  });
});

export default router;