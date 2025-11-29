exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create people table
  pgm.createTable("people", {
    id: "id",
    name: { type: "text", notNull: false },
    identity_vector: { type: "vector(512)", notNull: false },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // 2. Add person_id to faces table
  pgm.addColumns("faces", {
    person_id: {
      type: "integer",
      references: "people(id)",
      onDelete: "SET NULL",
      notNull: false,
    },
  });

  // (Optional) Index for faster lookups
  pgm.createIndex("faces", "person_id", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex("faces", "person_id", { ifExists: true });
  pgm.dropColumns("faces", ["person_id"]);
  pgm.dropTable("people");
};
