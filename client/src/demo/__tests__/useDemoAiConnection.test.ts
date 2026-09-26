import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ConnectResult } from '../../hooks/useAiConnection';
import { DEMO_AI_PROVIDER, DEMO_CONNECT_MS, useDemoAiConnection } from '../useDemoAiConnection';

function renderDemoConnection(speed = 1) {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const rendered = renderHook(() => useDemoAiConnection(speed));
  return { ...rendered, fetchMock };
}

describe('useDemoAiConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts disconnected with no provider', () => {
    const { result } = renderDemoConnection();

    expect(result.current.status).toBe('disconnected');
    expect(result.current.provider).toBeNull();
  });

  it('accepts any key after the connect pause, scaled by speed, without touching the network', async () => {
    vi.useFakeTimers();
    const { result, fetchMock } = renderDemoConnection(2);

    let connectResult: ConnectResult | undefined;
    act(() => {
      void result.current.connect('openai', 'sk-fake').then((value) => { connectResult = value; });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEMO_CONNECT_MS / 2 - 1);
    });
    expect(result.current.status).toBe('disconnected');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(connectResult).toEqual({ ok: true, provider: DEMO_AI_PROVIDER });
    expect(result.current.status).toBe('connected');
    expect(result.current.provider).toBe(DEMO_AI_PROVIDER);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disconnects without touching the network', async () => {
    vi.useFakeTimers();
    const { result, fetchMock } = renderDemoConnection();
    act(() => {
      void result.current.connect('anthropic', 'sk-fake');
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    let isDisconnected = false;
    await act(async () => {
      isDisconnected = await result.current.disconnect();
    });
    expect(isDisconnected).toBe(true);
    expect(result.current.status).toBe('disconnected');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
