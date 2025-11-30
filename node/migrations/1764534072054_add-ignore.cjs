exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add ignored flag to faces
  pgm.addColumn("faces", {
    ignored: { type: "boolean", notNull: true, default: false }
  });

  // Add ignored flag to face_clusters
  pgm.addColumn("face_clusters", {
    ignored: { type: "boolean", notNull: true, default: false }
  });

  // Indexes (helps queries filtering ignored items)
  pgm.createIndex("faces", "ignored", { ifNotExists: true });
  pgm.createIndex("face_clusters", "ignored", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex("faces", "ignored", { ifExists: true });
  pgm.dropIndex("face_clusters", "ignored", { ifExists: true });

  pgm.dropColumn("faces", "ignored", { ifExists: true });
  pgm.dropColumn("face_clusters", "ignored", { ifExists: true });
};