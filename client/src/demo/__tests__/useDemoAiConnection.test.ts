import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEMO_AI_PROVIDER, useDemoAiConnection } from '../useDemoAiConnection';

describe('useDemoAiConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a connected agent without touching the network', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDemoAiConnection());

    expect(result.current).toEqual({ status: 'connected', provider: DEMO_AI_PROVIDER });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
