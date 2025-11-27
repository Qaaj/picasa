export function inferExtraMetadata(file) {
  const name = file.originalname?.toLowerCase() || "";
  const fullPath = file.path?.toLowerCase() || "";

  const tags = new Set();
  const props = {};

  // WhatsApp
  if (name.includes("whatsapp") || fullPath.includes("whatsapp")) {
    tags.add("whatsapp");
    props.isWhatsApp = true;
  }

  // Screenshot
  if (name.includes("screenshot")) {
    tags.add("screenshot");
    props.isScreenshot = true;
  }

  // DJI Drone
  if (name.includes("dji") || name.includes("drone")) {
    tags.add("drone");
    props.isDrone = true;
  }

  // iPhone / Android
  if (name.includes("iphone")) {
    tags.add("iphone");
    props.deviceType = "iphone";
  }
  if (name.includes("android")) {
    tags.add("android");
    props.deviceType = "android";
  }

  // Detect year from filename
  const yearMatch = name.match(/20\d{2}/);
  if (yearMatch) {
    props.year = parseInt(yearMatch[0], 10);
    tags.add(String(props.year));
  }

  if (file.annotation?.description?.includes("personal")) {
    tags.add("NSFW");
  } else if (file.annotation?.description?.includes("private")) {
    tags.add("NSFW");
  } else if (file.annotation?.description?.includes("topless")) {
    tags.add("NSFW");
  } else if (file.annotation?.description?.includes("intimate")) {
    tags.add("NSFW");
  } else if (file.annotation?.description?.includes("nude")) {
    tags.add("NSFW");
  }

  return { tags: Array.from(tags), props };
}
