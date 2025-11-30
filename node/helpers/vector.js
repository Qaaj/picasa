export function toPgVector(arr) {
  if (!arr) return null;
  return `[${arr.join(",")}]`;
}
export function cosineDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 1;

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 1;

  const cos = dot / denom;

  // return distance, not similarity
  return 1 - cos;
}

export function parseVec(text) {
  if (!text) return null;
  return text
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map(Number);
}