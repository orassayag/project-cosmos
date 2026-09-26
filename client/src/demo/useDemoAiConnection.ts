import { useCallback, useMemo, useState } from 'react';
import type { AiConnection, AiProvider, ConnectResult } from '../hooks/useAiConnection';
import { scaledDuration } from './runDemo';

export const DEMO_AI_PROVIDER: AiProvider = 'anthropic';

/** How long the fake connect keeps the Connect window busy, at speed 1. */
export const DEMO_CONNECT_MS = 1800;

/**
 * A stand-in for `useAiConnection` while the demo plays: the Connect window's real submit
 * lands here, which accepts the fake keys after a pause and never touches the network.
 */
export function useDemoAiConnection(speed: number): AiConnection {
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async (): Promise<ConnectResult> => {
    await new Promise((resolve) => setTimeout(resolve, scaledDuration(DEMO_CONNECT_MS, speed)));
    setIsConnected(true);
    return { ok: true, provider: DEMO_AI_PROVIDER };
  }, [speed]);

  const disconnect = useCallback(async (): Promise<boolean> => {
    setIsConnected(false);
    return true;
  }, []);

  return useMemo(() => ({
    status: isConnected ? 'connected' : 'disconnected',
    provider: isConnected ? DEMO_AI_PROVIDER : null,
    connect,
    disconnect,
  }), [isConnected, connect, disconnect]);
}
