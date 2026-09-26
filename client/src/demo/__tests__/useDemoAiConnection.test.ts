import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AiConnection } from '../../hooks/useAiConnection';
import { runDemo } from '../runDemo';
import type { DemoActions, DemoAiStatus } from '../types';
import { DEMO_AI_PROVIDER, useDemoAiConnection } from '../useDemoAiConnection';

function renderDemoConnection() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const rendered = renderHook(() => useDemoAiConnection());
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
    expect(result.current.isConnecting).toBe(false);
  });

  it.each<[DemoAiStatus, AiConnection['status'], AiConnection['provider'], boolean]>([
    ['disconnected', 'disconnected', null, false],
    ['connecting', 'disconnected', null, true],
    ['connected', 'connected', DEMO_AI_PROVIDER, false],
  ])('maps demo status %s onto the AiConnection shape', (demoStatus, status, provider, isConnecting) => {
    const { result } = renderDemoConnection();

    act(() => result.current.setDemoStatus(demoStatus));

    expect(result.current.status).toBe(status);
    expect(result.current.provider).toBe(provider);
    expect(result.current.isConnecting).toBe(isConnecting);
  });

  it('connects and disconnects without touching the network', async () => {
    const { result, fetchMock } = renderDemoConnection();

    let connectResult: Awaited<ReturnType<AiConnection['connect']>> | undefined;
    await act(async () => {
      connectResult = await result.current.connect('openai', 'demo-key');
    });
    expect(connectResult).toEqual({ ok: true, provider: 'anthropic' });
    expect(result.current.status).toBe('connected');
    expect(result.current.provider).toBe('anthropic');

    let isDisconnected = false;
    await act(async () => {
      isDisconnected = await result.current.disconnect();
    });
    expect(isDisconnected).toBe(true);
    expect(result.current.status).toBe('disconnected');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is driven through connecting to connected by the runner', async () => {
    vi.useFakeTimers();
    const { result, fetchMock } = renderDemoConnection();
    const actions = { setAiStatus: (status: DemoAiStatus) => result.current.setDemoStatus(status) } as DemoActions;

    let run: Promise<unknown> = Promise.resolve();
    act(() => {
      run = runDemo([{ kind: 'connect', durationMs: 1000 }], actions, {
        signal: new AbortController().signal,
        speed: 1,
      });
    });
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.status).toBe('disconnected');

    await act(async () => {
      await vi.runAllTimersAsync();
      await run;
    });
    expect(result.current.status).toBe('connected');
    expect(result.current.provider).toBe('anthropic');
    expect(result.current.isConnecting).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
