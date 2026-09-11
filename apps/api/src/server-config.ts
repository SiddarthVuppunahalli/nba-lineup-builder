import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  host: string;
  port: number;
  webDistPath: string;
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
  };
}
