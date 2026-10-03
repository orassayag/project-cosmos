import { AI_PROVIDER_LABELS, type AiConnectionStatus, type AiProvider } from '../hooks/useAiConnection';

interface AgentButtonProps {
  status: AiConnectionStatus;
  provider: AiProvider | null;
  /** Green: the agent answers here. */
  onOpenChat: () => void;
  /** Red or still checking: the window explaining how to run the agent locally. */
  onOpenSetup: () => void;
}

const STATUS_MODIFIER: Record<AiConnectionStatus, string> = {
  connected: 'on',
  notLocal: 'off',
  notConfigured: 'off',
  unknown: 'unknown',
};

function statusTitle(status: AiConnectionStatus, provider: AiProvider | null): string {
  if (status === 'connected') return `AI agent connected (${provider ? AI_PROVIDER_LABELS[provider] : 'unknown provider'})`;
  if (status === 'unknown') return 'Checking for an AI agent';
  return 'No AI agent connected';
}

export function AgentButton({ status, provider, onOpenChat, onOpenSetup }: AgentButtonProps) {
  const modifier = STATUS_MODIFIER[status];
  return (
    <button
      type="button"
      className={`lc-agent-button lc-agent-button--${modifier}`}
      data-no-pan="true"
      data-demo-target="connect-open"
      aria-label="Open the agent chat"
      title={statusTitle(status, provider)}
      onClick={status === 'connected' ? onOpenChat : onOpenSetup}
    >
      <span className="lc-agent-button-face" aria-hidden="true">🤖</span>
      <span className="lc-agent-button-tail" aria-hidden="true" />
      <span className={`lc-status-dot lc-status-dot--${modifier}`} data-testid="ai-status-dot" aria-hidden="true" />
    </button>
  );
}
