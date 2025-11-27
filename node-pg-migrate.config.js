module.exports = {
  migrationFolder: "./migrations",
  direction: "up",
  databaseUrl: process.env.DATABASE_URL,
  logFileName: "migrate.log",
};
