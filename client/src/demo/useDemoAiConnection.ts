import { useCallback, useMemo, useState } from 'react';
import type { AiConnection, AiProvider, ConnectResult } from '../hooks/useAiConnection';
import type { DemoAiStatus } from './types';

export const DEMO_AI_PROVIDER: AiProvider = 'anthropic';

export interface DemoAiConnection extends AiConnection {
  /** True while the scripted `connect` step is in flight; App feeds it to the Connect window's busy state. */
  isConnecting: boolean;
  /** The runner's `DemoActions.setAiStatus`. */
  setDemoStatus: (status: DemoAiStatus) => void;
}

/**
 * A stand-in for `useAiConnection` while the demo plays. `connecting` still reads as
 * `disconnected` to consumers, because `AiConnectionStatus` has no in-between state.
 */
export function useDemoAiConnection(): DemoAiConnection {
  const [demoStatus, setDemoStatus] = useState<DemoAiStatus>('disconnected');

  const connect = useCallback(async (): Promise<ConnectResult> => {
    setDemoStatus('connected');
    return { ok: true, provider: DEMO_AI_PROVIDER };
  }, []);

  const disconnect = useCallback(async (): Promise<boolean> => {
    setDemoStatus('disconnected');
    return true;
  }, []);

  return useMemo(() => {
    const isConnected = demoStatus === 'connected';
    return {
      status: isConnected ? 'connected' : 'disconnected',
      provider: isConnected ? DEMO_AI_PROVIDER : null,
      isConnecting: demoStatus === 'connecting',
      connect,
      disconnect,
      setDemoStatus,
    };
  }, [demoStatus, connect, disconnect]);
}
