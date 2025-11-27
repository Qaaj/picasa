import path from "path";

export function buildTextEmbeddingInput({ annotation, exif, file, meta }) {
  const parts = [];

  // Annotation
  if (annotation?.title) parts.push(annotation.title);
  if (annotation?.description) parts.push(annotation.description);

  if (annotation?.tags?.length) {
    parts.push("Tags: " + annotation.tags.join(", "));
  }

  // Filename patterns
  const name = file.originalname.toLowerCase();

  if (name.includes("whatsapp")) parts.push("Shared via WhatsApp");
  if (name.includes("screenshot")) parts.push("Screenshot image");
  if (name.includes("dji")) parts.push("DJI drone image");
  if (name.includes("img_")) parts.push("Mobile camera photo");
  if (name.includes("dsc")) parts.push("Digital camera photo");

  // Folder name extraction
  const folder = path.basename(path.dirname(file.path));
  if (folder && folder !== "tmp") {
    parts.push("Folder category: " + folder);
  }

  // EXIF camera info
  if (exif?.Make || exif?.Model) {
    parts.push(`Camera: ${exif.Make || ""} ${exif.Model || ""}`);
  }

  if (meta?.taken_at) {
    parts.push("Taken: " + meta.taken_at);
  }

  // EXIF shooting info
  if (exif?.FocalLength) parts.push(`Focal length: ${exif.FocalLength}mm`);
  if (exif?.ISO) parts.push(`ISO ${exif.ISO}`);
  if (exif?.ExposureTime) parts.push(`Exposure time: ${exif.ExposureTime}s`);
  if (exif?.ApertureValue) parts.push(`Aperture: f/${exif.ApertureValue}`);

  // Location
  if (meta?.location_metadata?.lat) {
    parts.push(
      `Location coordinates: ${meta.location_metadata.lat}, ${meta.location_metadata.lon}`,
    );
  }

  return parts.join("\n");
}
