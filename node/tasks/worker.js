// tasks/worker.js
import "dotenv/config";
import { pool } from "../db/index.js";
import path from "path";
import fs from "fs/promises";
import { processImage } from "../services/processImage.js";
const WORKER_NAME = "folder_import_worker";
const BATCH_SIZE = 1; // one item at a time for safety

async function fetchNextItem() {
  const { rows } = await pool.query(
    `
      UPDATE task_items
      SET status = 'processing'
      WHERE id = (
        SELECT id
        FROM task_items
        WHERE status = 'pending'
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `
  );
  return rows[0] || null;
}

async function updateTaskProgress(taskId) {
  const { rows } = await pool.query(
    `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'done')::int AS done,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*)::int AS total
      FROM task_items
      WHERE task_id = $1
    `,
    [taskId]
  );

  const done = rows[0].done;
  const failed = rows[0].failed;
  const total = rows[0].total;
  const processedItems = done + failed;

  if (processedItems === total) {
    await pool.query(
      `
        UPDATE tasks
        SET processed_items = $1,
            total_items = $2,
            status = 'complete'
        WHERE id = $3
      `,
      [processedItems, total, taskId]
    );
  } else {
    await pool.query(
      `
        UPDATE tasks
        SET processed_items = $1,
            total_items = $2
        WHERE id = $3
      `,
      [processedItems, total, taskId]
    );
  }
}

async function processItem(item) {
  const filePath = item.target_id;

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("Not a file");
    }

    console.log(`[WORKER] Processing: ${filePath}`);

    const taskRes = await pool.query(
      "SELECT params FROM tasks WHERE id = $1",
      [item.task_id]
    );
    const taskParams = taskRes.rows[0]?.params || {};
    const extraTags = taskParams.tags || [];

    await processImage({
      filePath,
      originalName: null,
      fileBuffer: null,
      extraTags
    }, true);

    await pool.query(
      `UPDATE task_items SET status='done' WHERE id=$1`,
      [item.id]
    );

  } catch (err) {
    console.error(`[WORKER] Failed: ${filePath}`, err);

    await pool.query(
      `UPDATE task_items SET status='failed', error_message=$2 WHERE id=$1`,
      [item.id, err.message]
    );
  }

  await updateTaskProgress(item.task_id);
}

async function mainLoop() {
  console.log(`=== WORKER STARTED: ${WORKER_NAME} ===`);

  while (true) {
    const item = await fetchNextItem();

    if (!item) {
      await new Promise(r => setTimeout(r, 1000)); // idle wait
      continue;
    }

    await processItem(item);
  }
}

mainLoop().catch(err => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
