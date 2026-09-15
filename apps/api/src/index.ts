import { createApp } from './app.js';
import { OpenAiIntentInterpreter } from './ai/intent-interpreter.js';
import { resolveServerConfig } from './server-config.js';
import { createPostgresScenarioRepository } from './persistence/postgres-scenario-repository.js';

const config = resolveServerConfig();
const intentInterpreter = config.openAiApiKey
  ? new OpenAiIntentInterpreter({ apiKey: config.openAiApiKey, model: config.openAiModel })
  : undefined;
const persistence = config.databaseUrl
  ? createPostgresScenarioRepository(config.databaseUrl)
  : undefined;
const app = createApp({
  webDistPath: config.webDistPath,
  intentInterpreter,
  scenarioRepository: persistence?.repository,
});

const server = app.listen(config.port, config.host, () => {
  console.log(`Lineup Engine listening on http://${config.host}:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing Lineup Engine.`);
  server.close(async (error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
    await persistence?.close();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
