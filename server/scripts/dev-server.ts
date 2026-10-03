import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';

const DEV_SERVER_PORT = 8787;
// Same files `vercel dev` / `vercel env pull` use, so the AI routes see the same variables.
const ENV_FILES = ['../../.env.local', '../.env'].map((relativePath) => fileURLToPath(new URL(relativePath, import.meta.url)));

for (const envFile of ENV_FILES) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

// Imported after the env files load so any module reading `process.env` at import sees them.
const { default: app } = await import('../src/app.js');

serve({ fetch: app.fetch, port: DEV_SERVER_PORT }, ({ port }) => {
  console.log(`cosmos dev server: http://localhost:${port}/api/cosmos`);
});
