import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The ledger lists newest first, so the first table row of the newest year file is the current version.
function readLatestVersion(): string {
  const ledgerFiles = readdirSync('versions').filter((fileName) => /^\d{4}\.md$/.test(fileName)).sort();
  const newestLedger = ledgerFiles.at(-1);
  if (!newestLedger) return 'dev';
  const versionMatch = readFileSync(`versions/${newestLedger}`, 'utf8').match(/^\|\s*(\d+\.\d+\.\d+)\s*\|/m);
  return versionMatch?.[1] ?? 'dev';
}

export default defineConfig({
  // BASE_PATH is set by the Pages workflow (e.g. /project-cosmos/); local dev serves from /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(readLatestVersion()) },
  server: { port: 5173 },
});
