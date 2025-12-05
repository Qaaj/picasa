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
  pgm.createTable("tasks", {
    id: "id",
    type: { type: "text", notNull: true },
    name: { type: "text" },
    params: { type: "jsonb" },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
    },
    total_items: { type: "integer", notNull: true, default: 0 },
    processed_items: { type: "integer", notNull: true, default: 0 },
    error: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    started_at: { type: "timestamptz" },
    finished_at: { type: "timestamptz" },
  });

  pgm.createTable("task_items", {
    id: "id",
    task_id: {
      type: "integer",
      notNull: true,
      references: "tasks",
      onDelete: "CASCADE",
    },
    target_type: { type: "text", notNull: true },
    target_id: { type: "text", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
    },
    attempts: { type: "integer", notNull: true, default: 0 },
    error: { type: "text" },
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
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("task_items");
  pgm.dropTable("tasks");
};
