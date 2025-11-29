exports.up = (pgm) => {
  pgm.createExtension("vector", { ifNotExists: true });

  pgm.createTable("photos", {
    id: "id",
    file_hash: { type: "text", notNull: true, unique: true },
    file_name: { type: "text", notNull: true },
    file_path: { type: "text", notNull: true },
    width: { type: "integer" },
    height: { type: "integer" },
    exif: { type: "jsonb" },
    annotation: { type: "jsonb" },
    created_at: {
      type: "timestamp",
      default: pgm.func("NOW()"),
    },
  });

  pgm.createTable("photo_vectors", {
    photo_id: {
      type: "integer",
      notNull: true,
      references: "photos",
      onDelete: "cascade",
    },
    embedding: {
      type: "vector(1024)", // adjust for model size (256, 512, 1024)
      notNull: false,
    },
  });

  pgm.createIndex("photos", "file_hash", { unique: true });
  pgm.createIndex("photo_vectors", "embedding", { method: "ivfflat" });
};

exports.down = (pgm) => {
  pgm.dropTable("photo_vectors");
  pgm.dropTable("photos");
  pgm.dropExtension("vector");
};
