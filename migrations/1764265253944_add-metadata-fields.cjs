exports.up = (pgm) => {
  pgm.addColumns("photos", {
    location_point: { type: "point" },
    location_metadata: { type: "jsonb" },

    gps_altitude: { type: "double precision" },

    taken_at: { type: "timestamp" },

    camera_make: { type: "text" },
    camera_model: { type: "text" },
    lens: { type: "text" },

    focal_length: { type: "double precision" },
    iso: { type: "integer" },
    exposure_time: { type: "double precision" },
    aperture: { type: "double precision" },

    device_type: { type: "text" },
  });

  // Fast spatial search
  pgm.createIndex("photos", "location_point", {
    method: "gist",
    name: "photos_location_point_gist_idx",
  });

  // JSONB index
  pgm.createIndex("photos", "location_metadata", {
    method: "gin",
    name: "photos_location_metadata_gin_idx",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("photos", "location_point", {
    name: "photos_location_point_gist_idx",
  });

  pgm.dropIndex("photos", "location_metadata", {
    name: "photos_location_metadata_gin_idx",
  });

  pgm.dropColumns("photos", [
    "location_point",
    "location_metadata",
    "gps_altitude",
    "taken_at",
    "camera_make",
    "camera_model",
    "lens",
    "focal_length",
    "iso",
    "exposure_time",
    "aperture",
    "device_type",
  ]);
};
