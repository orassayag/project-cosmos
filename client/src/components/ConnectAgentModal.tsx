import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY, useOverlay } from '../overlays/OverlayManager';
import type { AiConnectionStatus } from '../hooks/useAiConnection';

export interface ConnectAgentModalProps {
  status: AiConnectionStatus;
}

const REASON_LINES = {
  notLocal: 'Live answers are only available when running the project locally.',
  notConfigured: 'No AI key is set yet.',
} as const;

/** Visibility and every open/close go through the overlay manager, so on phones it
 *  stacks over the answer panel and closing it brings that panel back intact. */
export function ConnectAgentModal({ status }: ConnectAgentModalProps) {
  const overlay = useOverlay();
  if (!overlay.isOpen(OVERLAY.connect)) return null;
  return createPortal(
    <ConnectAgentDialog status={status} onClose={() => overlay.close(OVERLAY.connect)} />,
    document.body,
  );
}

function ConnectAgentDialog({ status, onClose }: { status: AiConnectionStatus; onClose: () => void }) {
  const titleId = useId();
  // `unknown` (status not answered yet) gets the live-site wording: it is true for every visitor.
  const reasonLine = status === 'notConfigured' ? REASON_LINES.notConfigured : REASON_LINES.notLocal;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lc-help-overlay lc-connect-overlay" onClick={onClose}>
      <div
        className="lc-help-modal lc-connect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="lc-help-close" onClick={onClose} aria-label="Close">
          <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
          </svg>
        </button>

        <div className="lc-help-eyebrow">Ask the agent</div>
        <h2 id={titleId} className="lc-help-title">Set up the agent</h2>
        <p className="lc-connect-lede" data-testid="connect-reason">{reasonLine}</p>

        <ol className="lc-connect-steps">
          <li>
            Copy the example env file:
            <pre className="lc-connect-code"><code>cp server/.env.example server/.env</code></pre>
          </li>
          <li>
            Set one model key in <code>server/.env</code>:
            <pre className="lc-connect-code"><code>{'ANTHROPIC_API_KEY=<your key>\n# or\nOPENAI_API_KEY=<your key>'}</code></pre>
            <p className="lc-connect-note">Questions are billed to the AI account whose key you set.</p>
          </li>
          <li>
            Optional, for JEV question triage:
            <pre className="lc-connect-code"><code>{'AI_GATEWAY_API_KEY=<your key>'}</code></pre>
          </li>
          <li>
            Start the app — the bot turns green:
            <pre className="lc-connect-code"><code>pnpm dev</code></pre>
          </li>
        </ol>
      </div>
    </div>
  );
}
