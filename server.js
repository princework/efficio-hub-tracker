// Local / long-running entry point. On Vercel, api/index.js serves app.js instead.
const app = require('./app');

const PORT = process.env.PORT || 3100;

app.connectAndSeed()
  .then(() => {
    app.listen(PORT, () => console.log(`[Server] Running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('[Startup] Fatal error:', err.message, app.describeDbError(err));
    process.exit(1);
  });
