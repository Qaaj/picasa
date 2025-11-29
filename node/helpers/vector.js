export function toPgVector(arr) {
  if (!arr) return null;
  return `[${arr.join(",")}]`;
}
