exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add columns
  pgm.addColumns("photos", {
    fs_created_at: { type: "timestamptz", notNull: false },
    fs_modified_at: { type: "timestamptz", notNull: false },
    inserted_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Indexes (optional but recommended)
  pgm.createIndex("photos", "inserted_at", { ifNotExists: true });
  pgm.createIndex("photos", "taken_at", { ifNotExists: true });
  pgm.createIndex("photos", "fs_created_at", { ifNotExists: true });
  pgm.createIndex("photos", "fs_modified_at", { ifNotExists: true });
};

exports.down = (pgm) => {
  // Safe rollbacks
  pgm.dropIndex("photos", "inserted_at", { ifExists: true });
  pgm.dropIndex("photos", "taken_at", { ifExists: true });
  pgm.dropIndex("photos", "fs_created_at", { ifExists: true });
  pgm.dropIndex("photos", "fs_modified_at", { ifExists: true });

  pgm.dropColumns("photos", ["fs_created_at", "fs_modified_at", "inserted_at"]);
};
