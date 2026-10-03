import type { AiConnection, AiProvider } from '../hooks/useAiConnection';

export const DEMO_AI_PROVIDER: AiProvider = 'anthropic';

const DEMO_AI_CONNECTION: AiConnection = { status: 'connected', provider: DEMO_AI_PROVIDER };

/** A stand-in for `useAiConnection` while the demo plays: always green, and it never touches the network. */
export function useDemoAiConnection(): AiConnection {
  return DEMO_AI_CONNECTION;
}
