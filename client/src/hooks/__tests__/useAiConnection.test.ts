import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAiConnection } from '../useAiConnection';

function stubStatus(response: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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

  it('reports notLocal when the status route answers 503 AI_NOT_LOCAL', async () => {
    stubStatus(() => Response.json({ errorCode: 'AI_NOT_LOCAL' }, { status: 503 }));

    const connection = await settledStatus();

    expect(connection.status).toBe('notLocal');
    expect(connection.provider).toBeNull();
  });

  it('reports notConfigured when the status route answers 503 AI_NOT_CONFIGURED', async () => {
    stubStatus(() => Response.json({ errorCode: 'AI_NOT_CONFIGURED' }, { status: 503 }));

    const connection = await settledStatus();

    expect(connection.status).toBe('notConfigured');
    expect(connection.provider).toBeNull();
  });

  it('reports connected with the provider from a 200 status', async () => {
    stubStatus(() => Response.json({ connected: true, provider: 'openai' }));

    const connection = await settledStatus();

    expect(connection.status).toBe('connected');
    expect(connection.provider).toBe('openai');
  });

  it('reports notLocal for any other failure', async () => {
    stubStatus(() => Response.json({ errorCode: 'NOT_FOUND' }, { status: 404 }));
    expect((await settledStatus()).status).toBe('notLocal');
  });

  it('reports notLocal when the request fails', async () => {
    stubStatus(() => Promise.reject(new TypeError('offline')));
    expect((await settledStatus()).status).toBe('notLocal');
  });

  it('only ever asks the status route and offers no connect or disconnect', async () => {
    const fetchMock = stubStatus(() => Response.json({ connected: true, provider: 'anthropic' }));

    const connection = await settledStatus();

    expect(Object.keys(connection).sort()).toEqual(['provider', 'status']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/status', expect.anything());
  });

  describe('when disabled', () => {
    it('never calls fetch and reports notLocal', async () => {
      const fetchMock = stubStatus(() => Response.json({ connected: true, provider: 'openai' }));

      const { result } = renderHook(() => useAiConnection({ enabled: false }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.status).toBe('notLocal');
      expect(result.current.provider).toBeNull();
    });

    it('re-checks the status once enabled again', async () => {
      const fetchMock = stubStatus(() => Response.json({ connected: true, provider: 'anthropic' }));

      const { result, rerender } = renderHook(({ enabled }) => useAiConnection({ enabled }), {
        initialProps: { enabled: false },
      });
      expect(fetchMock).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => expect(result.current.status).toBe('connected'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.provider).toBe('anthropic');
    });
  });
});
