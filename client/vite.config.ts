import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const VERSIONS_DIRECTORY = fileURLToPath(new URL('../versions/', import.meta.url));
const APP_VERSION_MODULE_ID = 'virtual:app-version';
const RESOLVED_APP_VERSION_MODULE_ID = `\0${APP_VERSION_MODULE_ID}`;

// The ledger lists newest first, so the first table row of the newest year file is the current version.
function readLatestVersion(): string {
  const ledgerFiles = readdirSync(VERSIONS_DIRECTORY).filter((fileName) => /^\d{4}\.md$/.test(fileName)).sort();
  const newestLedger = ledgerFiles.at(-1);
  if (!newestLedger) return 'dev';
  const versionMatch = readFileSync(`${VERSIONS_DIRECTORY}${newestLedger}`, 'utf8').match(/^\|\s*(\d+\.\d+\.\d+)\s*\|/m);
  return versionMatch?.[1] ?? 'dev';
}

// A `define` is frozen when the dev server starts, so a long-running server kept showing an old
// version. Serving it as a module re-read on every ledger write keeps the badge current.
function appVersionPlugin(): Plugin {
  return {
    name: 'project-cosmos-app-version',
    resolveId: (id) => (id === APP_VERSION_MODULE_ID ? RESOLVED_APP_VERSION_MODULE_ID : undefined),
    load: (id) =>
      id === RESOLVED_APP_VERSION_MODULE_ID ? `export const APP_VERSION = ${JSON.stringify(readLatestVersion())};` : undefined,
    configureServer(server) {
      server.watcher.add(VERSIONS_DIRECTORY);
      const reloadOnLedgerChange = (filePath: string) => {
        if (!filePath.startsWith(VERSIONS_DIRECTORY)) return;
        const versionModule = server.moduleGraph.getModuleById(RESOLVED_APP_VERSION_MODULE_ID);
        if (versionModule) server.moduleGraph.invalidateModule(versionModule);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reloadOnLedgerChange);
      server.watcher.on('change', reloadOnLedgerChange);
    },
  };
}

export default defineConfig({
  // BASE_PATH is set by the Pages workflow (e.g. /project-cosmos/); local dev serves from /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), appVersionPlugin()],
  server: { port: 5173 },
});
