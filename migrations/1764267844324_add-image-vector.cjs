exports.up = (pgm) => {
  pgm.addColumn("photos", {
    image_vector: {
      type: "vector(512)",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("photos", "image_vector");
};
