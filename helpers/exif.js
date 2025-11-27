function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;

  if (typeof v === "object" && "numerator" in v && "denominator" in v) {
    return v.numerator / v.denominator;
  }

  return Number(v) || null;
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms)) return null;

  let [deg, min, sec] = dms;

  deg = toNumber(deg);
  min = toNumber(min);
  sec = toNumber(sec);

  if (deg == null || min == null || sec == null) return null;

  let dec = deg + min / 60 + sec / 3600;

  if (ref === "S" || ref === "W") dec = -dec;

  return dec;
}

export function extractStructuredExif(exif) {
  if (!exif) return {};

  // -------- LOCATION ----------
  let lat = null;
  let lon = null;
  let alt = null;

  // 1) Use exifr’s decimal fields if available
  if (typeof exif.latitude === "number" && typeof exif.longitude === "number") {
    lat = exif.latitude;
    lon = exif.longitude;
  } else {
    // 2) fallback to DMS
    lat = dmsToDecimal(exif.GPSLatitude, exif.GPSLatitudeRef);
    lon = dmsToDecimal(exif.GPSLongitude, exif.GPSLongitudeRef);
  }

  // altitude
  alt = toNumber(exif.GPSAltitude);

  const hasLocation = lat != null && lon != null;

  const location_point = hasLocation ? `(${lat}, ${lon})` : null;

  const location_metadata = hasLocation
    ? {
        lat,
        lon,
        alt,
        source: "exif",
      }
    : null;

  // -------- MAIN RETURN ----------
  return {
    location_point,
    location_metadata,

    gps_altitude: alt || null,
    taken_at: exif.DateTimeOriginal || exif.CreateDate || null,

    camera_make: exif.Make || null,
    camera_model: exif.Model || null,
    lens: exif.LensModel || null,

    focal_length: toNumber(exif.FocalLength),
    iso: exif.ISO || exif.ISOSpeedRatings || null,
    exposure_time: toNumber(exif.ExposureTime),
    aperture: toNumber(exif.ApertureValue),
    device_type: detectDeviceType(exif),
  };
}

function detectDeviceType(exif) {
  const make = (exif.Make || "").toLowerCase();
  if (make.includes("apple")) return "iphone";
  if (make.includes("dji")) return "drone";
  if (make.includes("canon")) return "dslr";
  if (make.includes("nikon")) return "dslr";
  if (make.includes("sony")) return "mirrorless";
  return "unknown";
}
