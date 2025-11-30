import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

router.get("/api/photos/geo", async (ctx) => {
  const res = await pool.query(`
    SELECT id, file_name, thumb_base64, location_point
    FROM photos
    WHERE location_point IS NOT NULL
  `);

  const mapped = res.rows.map((p) => {
    const lp = p.location_point;

    if (!lp) return null;

    let lat, lon;

    // PostGIS: returned as object { x: lon, y: lat }
    if (typeof lp === "object" && lp.x !== undefined && lp.y !== undefined) {
      lat = parseFloat(lp.x);
      lon = parseFloat(lp.y);
    }
    // Returned as "(lon,lat)" string
    else if (typeof lp === "string") {
      const coords = lp.replace(/[()]/g, "").split(",");
      lat = parseFloat(coords[0]);
      lon = parseFloat(coords[1]);
    }
    else {
      console.warn("Unknown location_point format:", lp);
      return null;
    }

    return {
      id: p.id,
      file_name: p.file_name,
      thumb_base64: p.thumb_base64,
      lat,   // correct order now
      lon,
    };
  });

  ctx.body = mapped;
});

router.get("/map", async (ctx) => {
  await ctx.render("map");
});

export default router;