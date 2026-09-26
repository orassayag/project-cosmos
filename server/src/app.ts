import { Hono } from 'hono';
import { createLogger } from './logger.js';

const logger = createLogger('app');

// Vercel forwards the full `/api/...` path and detects this file (src/app.ts) as the
// Hono entrypoint, so this module is both the app and the deployment entry.
const app = new Hono().basePath('/api');

app.notFound((context) => context.json({ errorCode: 'NOT_FOUND' }, 404));

// Replaces Hono's default handler, which would print the raw error (and anything it captured).
app.onError((_error, context) => {
  logger.error('Unhandled error in API route', { errorCode: 'INTERNAL_ERROR' });
  return context.json({ errorCode: 'INTERNAL_ERROR' }, 500);
});

export default app;
