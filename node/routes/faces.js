import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/faces", async (ctx) => {
  const result = await pool.query(`
    SELECT f.id, f.crop_base64, f.person_id, p.name AS person_name
    FROM faces f
    LEFT JOIN people p ON p.id = f.person_id
    ORDER BY f.id DESC
  `);

  await ctx.render("faces", {
    faces: result.rows,
    active: "faces",
  });
});

export default router;
