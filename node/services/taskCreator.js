// services/taskCreator.js
import fs from "fs";
import "dotenv/config";
import path from "path";
import { pool } from "../db/index.js";
import fg from "fast-glob";

function isImageFile(filename) {
  const ext = filename.toLowerCase();
  return (
    ext.endsWith(".jpg") ||
    ext.endsWith(".jpeg") ||
    ext.endsWith(".png") ||
    ext.endsWith(".heic") ||
    ext.endsWith(".webp")
  );
}

export async function collectFilesRecursively(rootPath, recursive = true) {
  const patterns = recursive
    ? ["**/*.{jpg,jpeg,png,heic,webp}"]
    : ["*.{jpg,jpeg,png,heic,webp}"];

  return await fg(patterns, {
    cwd: rootPath,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false
  });
}

/**
 * Creates:
 * - 1 task row
 * - many task_items rows
 */
export async function createFolderImportTask(rootPath, { tags = [], recursive = true } = {}) {
  const absRoot = path.resolve(rootPath);

  console.log("Scanning folder:", absRoot);
  const itemPaths = await collectFilesRecursively(absRoot, recursive);

  if (itemPaths.length === 0) {
    throw new Error(`No image files found in: ${absRoot}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskRes = await client.query(
      `
      INSERT INTO tasks (type, params, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `,
      ["folder_import", { rootPath: absRoot, tags, recursive }]
    );

    const taskId = taskRes.rows[0].id;

    const insertValues = [];
    const placeholders = [];

    const normalizedPaths = itemPaths.map(p =>
      p.replace(/\\/g, "/").toLowerCase()
    );

    normalizedPaths.forEach((p, idx) => {
      insertValues.push(
        taskId,
        "file",
        p,      // target_id is the absolute file path (string)
        "pending",
        0,
        null
      );
      const base = idx * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
      );
    });

    await client.query(
      `
      INSERT INTO task_items
      (task_id, target_type, target_id, status, attempts, error)
      VALUES ${placeholders.join(",")}
    `,
      insertValues
    );

    await client.query("COMMIT");

    return {
      taskId,
      fileCount: itemPaths.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}