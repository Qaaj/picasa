import Router from "koa-router";
import { createFolderImportTask } from "../services/taskCreator.js";

const router = new Router();

router.post("/api/tasks/folder-import", async (ctx) => {
  const { path } = ctx.request.body;

  if (!path) {
    ctx.status = 400;
    ctx.body = { error: "Missing 'path' in request body." };
    return;
  }

  try {
    const result = await createFolderImportTask(path);

    ctx.body = {
      success: true,
      taskId: result.taskId,
      fileCount: result.fileCount,
    };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

export default router;