exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable pgvector extension
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS vector;`);

  // Add face_scanned to photos table
  pgm.addColumns("photos", {
    face_scanned: { type: "varchar(50)", notNull: false },
  });

  // Create faces table
  pgm.createTable("faces", {
    id: "id", // serial PK

    photo_hash: {
      type: "varchar(64)",
      notNull: true,
      references: '"photos"(file_hash)',
      onDelete: "CASCADE",
    },

    face_index: { type: "integer", notNull: true },

    bbox: { type: "jsonb", notNull: true },
    landmarks: { type: "jsonb", notNull: true },
    confidence: { type: "float", notNull: false },

    // Only full face crop stored as base64 text
    crop_base64: { type: "text", notNull: false },

    embedding: { type: "vector(512)", notNull: true },
    embedding_version: { type: "varchar(50)", notNull: false },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Helpful indexes
  pgm.createIndex("faces", "photo_hash", { ifNotExists: true });
  pgm.createIndex("faces", "embedding", { ifNotExists: true });
  pgm.createIndex("faces", "created_at", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable("faces", { ifExists: true });
  pgm.dropColumns("photos", ["face_scanned"]);
};
