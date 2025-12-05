/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("albums", {
    id: "id",
    name: { type: "text", notNull: true },
    cover_photo_id: { type: "integer", references: "photos(id)", onDelete: "SET NULL" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") }
  });

  pgm.createTable("album_photos", {
    album_id: {
      type: "integer",
      notNull: true,
      references: "albums(id)",
      onDelete: "CASCADE"
    },
    photo_id: {
      type: "integer",
      notNull: true,
      references: "photos(id)",
      onDelete: "CASCADE"
    }
  });

  pgm.addConstraint("album_photos", "album_photos_pk", {
    primaryKey: ["album_id", "photo_id"]
  });

  pgm.createIndex("album_photos", ["album_id"]);
  pgm.createIndex("album_photos", ["photo_id"]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("album_photos");
  pgm.dropTable("albums");
};
