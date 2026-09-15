import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  host: string;
  port: number;
  webDistPath: string;
  openAiApiKey: string | undefined;
  openAiModel: string;
  databaseUrl: string | undefined;
}

export function resolveServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawPort = environment.PORT ?? environment.API_PORT ?? '3001';
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer from 1 to 65535; received "${rawPort}".`);
  }

  return {
    host: environment.HOST?.trim() || '0.0.0.0',
    port,
    webDistPath:
      environment.WEB_DIST_DIR?.trim() || fileURLToPath(new URL('../../web/dist', import.meta.url)),
    openAiApiKey: environment.OPENAI_API_KEY?.trim() || undefined,
    openAiModel: environment.OPENAI_INTENT_MODEL?.trim() || 'gpt-5.6-luna',
    databaseUrl: environment.DATABASE_URL?.trim() || undefined,
  };
}
