// routes/people.js
import Router from "koa-router";
import { pool } from "../db/index.js";

const router = new Router();

// List all people
router.get("/people", async (ctx) => {
  const res = await pool.query(`
    SELECT id, name
    FROM people
    ORDER BY name;
  `);

  await ctx.render("people", {
    active: "people",
    people: res.rows,
  });
});

router.get("/api/people/search", async (ctx) => {
  const name = ctx.query.name || "";

  const result = await pool.query(
    `
    SELECT id, name
    FROM people
    WHERE name ILIKE $1
    ORDER BY name ASC
    LIMIT 20
    `,
    [`${name}%`]
  );

  ctx.body = result.rows;
  ctx.status = 200;
});

// Person detail page
router.get("/people/:id", async (ctx) => {
  const id = Number(ctx.params.id);

  const personRes = await pool.query(
    `SELECT id, name FROM people WHERE id = $1`,
    [id]
  );

  if (personRes.rows.length === 0) {
    ctx.throw(404, "Person not found");
  }
  const person = personRes.rows[0];

  // Load all faces + photos for this person
  const facesRes = await pool.query(
    `
    SELECT
      f.id,
      f.crop_base64,
      f.photo_hash,
      p.id AS photo_id
    FROM faces f
    JOIN photos p ON p.file_hash = f.photo_hash
    WHERE f.person_id = $1
    ORDER BY f.id;
    `,
    [id]
  );

  await ctx.render("people-detail", {
    active: "people",
    person,
    faces: facesRes.rows,
  });
});

export default router;