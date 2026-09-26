import { useCallback, useEffect, useState } from 'react';

export type AiProvider = 'anthropic' | 'openai';
export type AiConnectionStatus = 'unknown' | 'connected' | 'disconnected' | 'notConfigured';

export type ConnectErrorCode = 'INVALID_KEY' | 'AI_NOT_CONFIGURED' | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';

export type ConnectResult =
  | { ok: true; provider: AiProvider }
  | { ok: false; errorCode: ConnectErrorCode };

export interface AiConnection {
  status: AiConnectionStatus;
  provider: AiProvider | null;
  connect: (provider: AiProvider, apiKey: string) => Promise<ConnectResult>;
  disconnect: () => Promise<boolean>;
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
};

interface StatusBody {
  connected?: boolean;
  provider?: AiProvider;
  errorCode?: string;
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === 'anthropic' || value === 'openai';
}

async function readBody(response: Response): Promise<StatusBody> {
  try {
    return (await response.json()) as StatusBody;
  } catch {
    return {};
  }
}

function toConnectErrorCode(errorCode: string | undefined): ConnectErrorCode {
  if (errorCode === 'INVALID_KEY' || errorCode === 'AI_NOT_CONFIGURED') return errorCode;
  return 'UNEXPECTED_RESPONSE';
}

/**
 * The AI key lives in an httpOnly cookie, so the server is the only source of
 * truth. A 503 AI_NOT_CONFIGURED status means this deployment cannot connect at
 * all (`notConfigured`, no connect affordances); any other failed or non-OK
 * check (routes absent, offline) resolves to `disconnected` rather than throwing.
 */
export function useAiConnection(): AiConnection {
  const [status, setStatus] = useState<AiConnectionStatus>('unknown');
  const [provider, setProvider] = useState<AiProvider | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/status', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const body = await readBody(response);
        if (response.status === 503 && body.errorCode === 'AI_NOT_CONFIGURED') {
          setStatus('notConfigured');
          setProvider(null);
          return;
        }
        const isConnected = response.ok && body.connected === true && isAiProvider(body.provider);
        setStatus(isConnected ? 'connected' : 'disconnected');
        setProvider(isConnected ? (body.provider as AiProvider) : null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus('disconnected');
        setProvider(null);
      });
    return () => controller.abort();
  }, []);

  const connect = useCallback(async (nextProvider: AiProvider, apiKey: string): Promise<ConnectResult> => {
    let response: Response;
    try {
      response = await fetch('/api/ai/connect', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: nextProvider, apiKey }),
      });
    } catch {
      return { ok: false, errorCode: 'NETWORK_ERROR' };
    }
    const body = await readBody(response);
    if (!response.ok || body.connected !== true || !isAiProvider(body.provider)) {
      return { ok: false, errorCode: toConnectErrorCode(body.errorCode) };
    }
    setStatus('connected');
    setProvider(body.provider);
    return { ok: true, provider: body.provider };
  }, []);

  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/ai/disconnect', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    setStatus('disconnected');
    setProvider(null);
    return true;
  }, []);

  return { status, provider, connect, disconnect };
}
