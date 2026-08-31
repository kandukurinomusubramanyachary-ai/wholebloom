try { require('dotenv').config(); } catch {}
const { loadConfig } = require('./config/env');
const { createApp } = require('./app');

const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ service: 'meg-engine-v2', port: config.port, host: config.host, persistence: app.locals.meg.store.driver }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ service: 'meg-engine-v2', event: 'shutdown', signal }));
  server.close(() => {
    try { app.locals.meg.store.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
