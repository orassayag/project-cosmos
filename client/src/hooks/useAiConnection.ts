import { useEffect, useState } from 'react';

export type AiProvider = 'anthropic' | 'openai';
export type AiConnectionStatus = 'unknown' | 'connected' | 'notLocal' | 'notConfigured';

export interface AiConnection {
  status: AiConnectionStatus;
  provider: AiProvider | null;
}

export interface UseAiConnectionOptions {
  /** When false (the scripted demo is running) the server is never asked and the status reads `notLocal`. */
  enabled?: boolean;
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

function toStatus(response: Response, body: StatusBody): AiConnectionStatus {
  if (response.ok && body.connected === true && isAiProvider(body.provider)) return 'connected';
  if (body.errorCode === 'AI_NOT_CONFIGURED') return 'notConfigured';
  return 'notLocal';
}

/**
 * The server reads the AI key from its own env, so its status route is the only
 * source of truth. Any failure other than a 503 `AI_NOT_CONFIGURED` (the live site,
 * routes absent, offline) reads as `notLocal`, the "run it locally" case.
 */
export function useAiConnection({ enabled = true }: UseAiConnectionOptions = {}): AiConnection {
  const [status, setStatus] = useState<AiConnectionStatus>('unknown');
  const [provider, setProvider] = useState<AiProvider | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/ai/status', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const body = await readBody(response);
        const nextStatus = toStatus(response, body);
        setStatus(nextStatus);
        setProvider(nextStatus === 'connected' ? (body.provider as AiProvider) : null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus('notLocal');
        setProvider(null);
      });
    return () => controller.abort();
  }, [enabled]);

  if (!enabled) return { status: 'notLocal', provider: null };
  return { status, provider };
}
