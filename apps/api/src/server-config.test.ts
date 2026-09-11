import { describe, expect, it } from 'vitest';

import { resolveServerConfig } from './server-config.js';

describe('production server configuration', () => {
  it('uses conventional hosting variables and supports an explicit web build path', () => {
    expect(
      resolveServerConfig({ PORT: '8080', HOST: '127.0.0.1', WEB_DIST_DIR: '/preview/web' }),
    ).toEqual({
      port: 8080,
      host: '127.0.0.1',
      webDistPath: '/preview/web',
    });
  });

  it('keeps API_PORT as a local compatibility fallback', () => {
    expect(resolveServerConfig({ API_PORT: '3100' }).port).toBe(3100);
  });

  it('rejects invalid ports before starting the service', () => {
    expect(() => resolveServerConfig({ PORT: 'not-a-port' })).toThrow(
      'PORT must be an integer from 1 to 65535',
    );
  });
});
