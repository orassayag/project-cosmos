import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAiConnection } from '../useAiConnection';

function stubStatus(response: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
}

async function settledStatus() {
  const { result } = renderHook(() => useAiConnection());
  await waitFor(() => expect(result.current.status).not.toBe('unknown'));
  return result.current;
}

describe('useAiConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports notConfigured when the status route answers 503 AI_NOT_CONFIGURED', async () => {
    stubStatus(() => Response.json({ errorCode: 'AI_NOT_CONFIGURED' }, { status: 503 }));

    const connection = await settledStatus();

    expect(connection.status).toBe('notConfigured');
    expect(connection.provider).toBeNull();
  });

  it('reports connected with the provider from a connected status', async () => {
    stubStatus(() => Response.json({ connected: true, provider: 'openai' }));

    const connection = await settledStatus();

    expect(connection.status).toBe('connected');
    expect(connection.provider).toBe('openai');
  });

  it('reports disconnected for a not-connected status', async () => {
    stubStatus(() => Response.json({ connected: false }));

    expect((await settledStatus()).status).toBe('disconnected');
  });

  it('reports disconnected for any other failure', async () => {
    stubStatus(() => Response.json({ errorCode: 'NOT_FOUND' }, { status: 404 }));
    expect((await settledStatus()).status).toBe('disconnected');
  });

  it('reports disconnected when the request fails', async () => {
    stubStatus(() => Promise.reject(new TypeError('offline')));
    expect((await settledStatus()).status).toBe('disconnected');
  });
});
