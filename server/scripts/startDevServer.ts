import { existsSync } from 'node:fs';
import { serve, type ServerType } from '@hono/node-server';

export const DEV_SERVER_PORT = 8787;
export const DEV_SERVER_HOSTNAME = '127.0.0.1';

export interface StartDevServerOptions {
  envFiles: string[];
  serveApp?: typeof serve;
}

export async function startDevServer({ envFiles, serveApp = serve }: StartDevServerOptions): Promise<ServerType> {
  for (const envFile of envFiles) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
  // Set after the env files load so a file can never decide it: this is the only place the agent is enabled.
  process.env.COSMOS_LOCAL_AGENT = '1';

  const { default: app } = await import('../src/app.js');

  return serveApp({ fetch: app.fetch, port: DEV_SERVER_PORT, hostname: DEV_SERVER_HOSTNAME }, ({ port }) => {
    console.log(`cosmos dev server: http://localhost:${port}/api/cosmos`);
  });
}
