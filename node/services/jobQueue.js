// services/jobQueue.js
export function enqueue(fn) {
  setImmediate(() => {
    fn().catch((err) => console.error("Async job failed:", err));
  });
}
