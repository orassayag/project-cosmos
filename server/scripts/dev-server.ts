import { fileURLToPath } from 'node:url';
import { startDevServer } from './startDevServer.js';

// Same files `vercel dev` / `vercel env pull` use, so the AI routes see the same variables.
const ENV_FILES = ['../../.env.local', '../.env'].map((relativePath) => fileURLToPath(new URL(relativePath, import.meta.url)));

await startDevServer({ envFiles: ENV_FILES });
