import path from "path";
import { inferExtraMetadata } from "./infer-extra.js";

export function buildTextEmbeddingInput({ file, meta, exif, annotation }) {
  const extra = inferExtraMetadata(file);

  let parts = [];

  parts.push(`filename: ${file.originalname}`);
  parts.push(`path: ${file.path}`);

  // include EXIF
  if (meta?.camera_make) parts.push(`camera make: ${meta.camera_make}`);
  if (meta?.taken_at) parts.push(`taken at: ${meta.taken_at}`);

  // include annotation text
  if (annotation?.title) parts.push(`title: ${annotation.title}`);
  if (annotation?.description)
    parts.push(`description: ${annotation.description}`);

  // EXTRA metadata (centralized)
  if (extra.tags.length > 0) {
    parts.push(`extra tags: ${extra.tags.join(", ")}`);
  }

  if (extra.props.year) {
    parts.push(`year: ${extra.props.year}`);
  }

  return parts.join("\n");
}
