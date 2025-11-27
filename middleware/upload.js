import multer from "multer";

const upload = multer({ dest: "tmp/" });

export const koaMulter = (field) => {
  const middleware = upload.single(field);

  return async (ctx, next) => {
    await new Promise((resolve, reject) => {
      middleware(ctx.req, ctx.res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    ctx.file = ctx.req.file;
    ctx.files = ctx.req.files;

    await next();
  };
};
