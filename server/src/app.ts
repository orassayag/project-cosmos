import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { stream } from 'hono/streaming';
import type { z } from 'zod';
import { answerQuestion } from './agent/askAnswer.js';
import { AI_NOT_CONFIGURED, getCookieSecret } from './config.js';
import {
  AI_COOKIE_NAME,
  AI_COOKIE_OPTIONS,
  decryptCookiePayload,
  encryptCookiePayload,
  type AiCookiePayload,
} from './cookieCrypto.js';
import cosmosMap from './generated/cosmos-map.json' with { type: 'json' };
import { createLogger } from './logger.js';
import { checkProviderKey } from './providerKeyCheck.js';
import { AskRequestSchema } from './schemas/askRequestSchema.js';
import { ConnectRequestSchema } from './schemas/connectRequestSchema.js';

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

function clearAiCookie(context: Context): void {
  deleteCookie(context, AI_COOKIE_NAME, AI_COOKIE_OPTIONS);
}

function aiNotConfigured(context: Context) {
  return context.json({ errorCode: AI_NOT_CONFIGURED }, 503);
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

/** Null when there is no cookie; a cookie that fails to decrypt is also null, and is cleared. */
function readAiCookie(context: Context, secret: Buffer): AiCookiePayload | null {
  const cookieValue = getCookie(context, AI_COOKIE_NAME);
  if (!cookieValue) {
    return null;
  }
  const payload = decryptCookiePayload(cookieValue, secret);
  if (!payload) {
    clearAiCookie(context);
  }
  return payload;
}

app.post('/ai/connect', async (context) => {
  const secret = getCookieSecret();
  if (!secret) {
    return aiNotConfigured(context);
  }
  const validated = await validateJsonBody(context, ConnectRequestSchema);
  if (!validated.success) {
    return validated.response;
  }
  const { provider, apiKey } = validated.data;
  const keyCheck = await checkProviderKey(provider, apiKey);
  if (keyCheck === 'invalid') {
    logger.warn('Provider rejected the submitted key', { errorCode: 'INVALID_KEY', provider });
    return context.json({ errorCode: 'INVALID_KEY' }, 400);
  }
  if (keyCheck === 'unavailable') {
    return context.json({ errorCode: 'PROVIDER_UNAVAILABLE' }, 502);
  }
  setCookie(context, AI_COOKIE_NAME, encryptCookiePayload({ provider, apiKey }, secret), AI_COOKIE_OPTIONS);
  return context.json({ connected: true, provider });
});

// Deliberately independent of AI_COOKIE_SECRET: the client disconnects after an
// INVALID_KEY, and that must work even when AI is not configured.
app.post('/ai/disconnect', (context) => {
  clearAiCookie(context);
  return context.json({ connected: false });
});

app.get('/ai/status', async (context) => {
  const secret = getCookieSecret();
  if (!secret) {
    return aiNotConfigured(context);
  }
  const payload = readAiCookie(context, secret);
  if (!payload) {
    return context.json({ connected: false });
  }
  // An unavailable provider keeps the user connected: this check is advisory, only a 401 is proof.
  if ((await checkProviderKey(payload.provider, payload.apiKey)) === 'invalid') {
    logger.info('Stored key was revoked; clearing the AI cookie', { errorCode: 'KEY_REVOKED', provider: payload.provider });
    clearAiCookie(context);
    return context.json({ connected: false, reason: 'KEY_REVOKED' });
  }
  return context.json({ connected: true, provider: payload.provider });
});

app.post('/ai/ask', async (context) => {
  const secret = getCookieSecret();
  if (!secret) {
    return aiNotConfigured(context);
  }
  // Checked before the body or the classifier, so the owner's gateway key is only
  // spent on visitors who already hold a working provider key.
  const payload = readAiCookie(context, secret);
  if (!payload) {
    return context.json({ errorCode: 'NOT_CONNECTED' }, 401);
  }
  const validated = await validateJsonBody(context, AskRequestSchema);
  if (!validated.success) {
    return validated.response;
  }
  const { question } = validated.data;

  context.header('Content-Type', 'application/x-ndjson');
  context.header('Cache-Control', 'no-store');
  return stream(
    context,
    async (responseStream) => {
      const streamAbort = new AbortController();
      responseStream.onAbort(() => streamAbort.abort());
      const signal = AbortSignal.any([context.req.raw.signal, streamAbort.signal]);
      for await (const event of answerQuestion({ question, payload, snapshot: cosmosMap, signal })) {
        await responseStream.write(`${JSON.stringify(event)}\n`);
      }
    },
    async (_error, responseStream) => {
      logger.error('Unhandled error while streaming an answer', { errorCode: 'INTERNAL_ERROR', provider: payload.provider });
      await responseStream.write(`${JSON.stringify({ type: 'error', errorCode: 'INTERNAL_ERROR' })}\n`);
    },
  );
});

export default app;
