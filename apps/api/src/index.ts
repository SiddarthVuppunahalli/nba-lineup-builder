import { createApp } from './app.js';
import { resolveServerConfig } from './server-config.js';

const config = resolveServerConfig();
const app = createApp({ webDistPath: config.webDistPath });

const server = app.listen(config.port, config.host, () => {
  console.log(`Lineup Engine listening on http://${config.host}:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing Lineup Engine.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
