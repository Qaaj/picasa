exports.up = (pgm) => {
  pgm.addColumn("photos", {
    thumb_base64: { type: "text" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("photos", "thumb_base64");
};
