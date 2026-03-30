module.exports = {
    apps: [
      {
        name: "pics",
        script: "npm run start",
        env: {
          NODE_ENV: "production",
          PORT: 3001
        }
      }
    ]
};