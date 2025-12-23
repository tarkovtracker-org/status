module.exports = {
  apps: [
    {
      name: "tarkovtracker-status",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3777,
      },
    },
  ],
};
