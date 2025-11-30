/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("face_clusters", {
    id: "id",
    centroid: { type: "vector(512)", notNull: true },
    face_count: { type: "integer", notNull: true, default: 1 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") }
  });

  pgm.addColumn("faces", {
    cluster_id: { type: "integer", references: "face_clusters", onDelete: "SET NULL" }
  });

  pgm.createIndex("face_clusters", "centroid", { ifNotExists: true });
  pgm.createIndex("faces", "cluster_id", { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropIndex("faces", "cluster_id", { ifExists: true });
  pgm.dropColumn("faces", "cluster_id");

  pgm.dropIndex("face_clusters", "centroid", { ifExists: true });
  pgm.dropTable("face_clusters", { ifExists: true });
};
