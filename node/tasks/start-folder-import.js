// tasks/start-folder-import.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createFolderImportTask } from "../services/taskCreator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ---------------------------
// CLI arg parsing
// ---------------------------
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node start-folder-import.js <folder> [--recursive] [--tags=tag1,tag2]");
  process.exit(1);
}

const rootPath = args[0];

let recursive = true;
let tags = [];

for (const arg of args.slice(1)) {
  if (arg.startsWith("--recursive=")) {
    recursive = arg.split("=")[1] === "true";
  }

  if (arg.startsWith("--tags=")) {
    const raw = arg.split("=")[1];
    tags = raw.split(",").map(s => s.trim()).filter(Boolean);
  }
}

async function main() {
  try {
    const result = await createFolderImportTask(rootPath, { tags, recursive });
    console.log("Task created:");
    console.log("  Task ID:", result.taskId);
    console.log("  Files:", result.fileCount);
    console.log(`\nView task in browser: http://localhost:3000/tasks/${result.taskId}`);
  } catch (err) {
    console.error("Error creating folder import task:", err);
  }
}

main();