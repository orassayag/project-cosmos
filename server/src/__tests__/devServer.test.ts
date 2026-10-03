import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { serve } from '@hono/node-server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEV_SERVER_HOSTNAME, DEV_SERVER_PORT, startDevServer } from '../../scripts/startDevServer.js';

describe('startDevServer', () => {
  let serveApp: ReturnType<typeof vi.fn<typeof serve>>;

  beforeEach(() => {
    vi.stubEnv('COSMOS_LOCAL_AGENT', undefined);
    serveApp = vi.fn<typeof serve>(() => ({}) as ReturnType<typeof serve>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds the API to loopback only', async () => {
    await startDevServer({ envFiles: [], serveApp });

    expect(serveApp).toHaveBeenCalledTimes(1);
    expect(serveApp.mock.calls[0][0]).toMatchObject({ hostname: '127.0.0.1', port: DEV_SERVER_PORT });
    expect(DEV_SERVER_HOSTNAME).toBe('127.0.0.1');
  });

  it('sets COSMOS_LOCAL_AGENT itself even when an env file tried to set it', async () => {
    const envFile = join(mkdtempSync(join(tmpdir(), 'cosmos-dev-server-')), '.env');
    writeFileSync(envFile, 'COSMOS_LOCAL_AGENT=0\n');

    await startDevServer({ envFiles: [envFile, join(tmpdir(), 'missing-cosmos.env')], serveApp });

    expect(process.env.COSMOS_LOCAL_AGENT).toBe('1');
  });
});
