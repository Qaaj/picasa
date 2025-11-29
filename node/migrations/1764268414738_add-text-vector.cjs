// migrations/1764269999999_add_embedding_text.cjs

exports.up = (pgm) => {
  pgm.addColumn("photos", {
    embedding_text: {
      type: "vector(768)",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("photos", "embedding_text");
};
