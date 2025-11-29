import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/photo/:id", async (ctx) => {
  const id = ctx.params.id;

  const { rows } = await pool.query(`SELECT * FROM photos WHERE id=$1`, [id]);

  if (rows.length === 0) {
    ctx.throw(404, "Photo not found");
  }

  await ctx.render("photo-detail", { photo: rows[0], active: "photo-detail" });
});

export default router;
