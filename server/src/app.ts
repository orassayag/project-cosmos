import { Hono, type Context } from 'hono';
import { stream } from 'hono/streaming';
import type { z } from 'zod';
import { getAgentConfig, type AgentUnavailableReason } from './agentConfig.js';
import { getCosmosResponseBody, getCosmosView } from './cosmos/view.js';
import { createLogger } from './logger.js';
import { AskRequestSchema } from './schemas/askRequestSchema.js';

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

// Browsers revalidate after a minute; the CDN keeps a copy until the next deploy, which is the only way the data changes.
const COSMOS_CACHE_CONTROL = 'public, max-age=60, s-maxage=31536000, stale-while-revalidate=86400';

function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch.split(',').some((candidate) => {
    const tag = candidate.trim();
    return tag === '*' || tag.replace(/^W\//, '') === etag;
  });
}

app.get('/cosmos', (context) => {
  const { version, json } = getCosmosResponseBody();
  const etag = `"${version}"`;
  context.header('ETag', etag);
  context.header('Cache-Control', COSMOS_CACHE_CONTROL);
  if (matchesEtag(context.req.header('If-None-Match'), etag)) {
    return context.body(null, 304);
  }
  context.header('Content-Type', 'application/json; charset=UTF-8');
  return context.body(json);
});

function agentUnavailable(context: Context, reason: AgentUnavailableReason) {
  return context.json({ errorCode: reason }, 503);
}

async function readJsonBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

type ValidatedBody<Schema extends z.ZodType> =
  | { success: true; data: z.infer<Schema> }
  | { success: false; response: Response };

async function validateJsonBody<Schema extends z.ZodType>(
  context: Context,
  schema: Schema,
): Promise<ValidatedBody<Schema>> {
  const body = await readJsonBody(context);
  if (body === undefined) {
    return {
      success: false,
      response: context.json(
        { errorCode: 'INVALID_REQUEST', field: 'body', message: 'Request body must be valid JSON' },
        400,
      ),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return {
      success: false,
      response: context.json(
        { errorCode: 'INVALID_REQUEST', field: issue.path.join('.') || 'body', message: issue.message },
        400,
      ),
    };
  }
  return { success: true, data: parsed.data };
}

app.get('/ai/status', (context) => {
  const agentConfig = getAgentConfig();
  if (!agentConfig.ok) {
    return agentUnavailable(context, agentConfig.reason);
  }
  return context.json({ connected: true, provider: agentConfig.config.provider });
});

app.post('/ai/ask', async (context) => {
  const agentConfig = getAgentConfig();
  if (!agentConfig.ok) {
    return agentUnavailable(context, agentConfig.reason);
  }
  const { config } = agentConfig;
  const validated = await validateJsonBody(context, AskRequestSchema);
  if (!validated.success) {
    return validated.response;
  }
  const { question } = validated.data;
  // Lazy, so LangChain and the provider SDKs never load for (or can break) the map's own routes.
  const { answerQuestion } = await import('./agent/askAnswer.js');

  context.header('Content-Type', 'application/x-ndjson');
  context.header('Cache-Control', 'no-store');
  return stream(
    context,
    async (responseStream) => {
      const streamAbort = new AbortController();
      responseStream.onAbort(() => streamAbort.abort());
      const signal = AbortSignal.any([context.req.raw.signal, streamAbort.signal]);
      for await (const event of answerQuestion({ question, config, view: getCosmosView(), signal })) {
        await responseStream.write(`${JSON.stringify(event)}\n`);
      }
    },
    async (_error, responseStream) => {
      logger.error('Unhandled error while streaming an answer', { errorCode: 'INTERNAL_ERROR', provider: config.provider });
      await responseStream.write(`${JSON.stringify({ type: 'error', errorCode: 'INTERNAL_ERROR' })}\n`);
    },
  );
});

export default app;
