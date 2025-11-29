// Common screenshot widths (downscaled or device-native)
const SCREENSHOT_WIDTHS = new Set([
  720, 750, 828, 1080, 1125, 1170, 1242, 1284, 1440, 1920, 2560, 3840, 3440,
]);

export function inferExtraMetadata(file) {
  const name = file.originalname?.toLowerCase() || "";
  const fullPath = file.path?.toLowerCase() || "";
  const exif = file.exif || {};
  const meta = file.meta || {};
  const annotation = file.annotation?.description?.toLowerCase?.() || "";

  const tags = new Set();
  const props = {};

  //
  // 1. WhatsApp
  //
  if (name.includes("whatsapp") || fullPath.includes("whatsapp")) {
    tags.add("whatsapp");
    props.isWhatsApp = true;
  }

  //
  // 2. Screenshot detection (EXIF-based)
  //
  let isScreenshot = false;

  const mime = exif.MIMEType?.toLowerCase?.() || "";
  const color = exif.ColorType || "";
  const width = exif.ImageWidth;
  const height = exif.ImageHeight;

  const hasCameraEXIF =
    exif.Make ||
    exif.Model ||
    exif.LensModel ||
    exif.FocalLength ||
    meta.camera_make ||
    meta.camera_model;

  if (file.imageMeta) {
    const im = file.imageMeta;

    const isPNG = im.format === "png";
    const hasAlpha = im.hasAlpha === true;
    const isWeirdAspect =
      im.width > 0 &&
      im.height > 0 &&
      (im.width / im.height < 0.8 || im.width / im.height > 2.0);

    // Very strong signals
    if (isPNG && hasAlpha) {
      isScreenshot = true;
    }

    // PNG + no EXIF → screenshot
    if (isPNG && !hasCameraEXIF) {
      isScreenshot = true;
    }

    // Common screenshot widths
    if (im.width && SCREENSHOT_WIDTHS.has(im.width)) {
      isScreenshot = true;
    }

    // Strange wide or tall aspect ratio (screenshots often are)
    if (isWeirdAspect && isPNG && !hasCameraEXIF) {
      isScreenshot = true;
    }
  }

  if (isScreenshot) {
    tags.add("screenshot");
    props.isScreenshot = true;
  }

  //
  // 3. DJI Drone
  //
  if (
    name.includes("dji") ||
    name.includes("drone") ||
    exif.Model?.toLowerCase?.().includes("dji")
  ) {
    tags.add("drone");
    props.isDrone = true;
  }

  //
  // 4. Device type
  //
  if (exif.Model?.toLowerCase?.().includes("iphone")) {
    tags.add("iphone");
    props.deviceType = "iphone";
  }
  if (
    exif.Make?.toLowerCase?.().includes("samsung") ||
    exif.Model?.toLowerCase?.().includes("pixel")
  ) {
    tags.add("android");
    props.deviceType = "android";
  }

  //
  // 5. Year inside filename
  //
  const yearMatch = name.match(/20\d{2}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);
    props.year = year;
    tags.add(String(year));
  }

  //
  // 6. NSFW text tags
  //
  //
  const NSFW_KEYWORDS = [
    "personal",
    "private",
    "topless",
    "intimate",
    "nude",
    "sexual",
    "bedroom",
    "partially undressed",
  ];

  for (const key of NSFW_KEYWORDS) {
    if (annotation.includes(key)) {
      tags.add("NSFW");
      props.isNSFW = true;
      break;
    }
  }

  if (props.isScreenshot) {
    tags.add("screenshot");
  }

  return { tags: Array.from(tags), props };
}
