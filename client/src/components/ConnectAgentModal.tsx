import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY, useOverlay } from '../overlays/OverlayManager';

/** Visibility and every open/close go through the overlay manager, so on phones it
 *  stacks over the answer panel and closing it brings that panel back intact. */
export function ConnectAgentModal() {
  const overlay = useOverlay();
  if (!overlay.isOpen(OVERLAY.connect)) return null;
  return createPortal(<ConnectAgentDialog onClose={() => overlay.close(OVERLAY.connect)} />, document.body);
}

function ConnectAgentDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();

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
        <h2 id={titleId} className="lc-help-title">The agent runs locally</h2>
        <p className="lc-connect-lede">
          AI answers only work when you run Project Cosmos on your own machine. Put an Anthropic or OpenAI key in{' '}
          <code>server/.env</code>, then start <code>pnpm dev</code> — the bot turns green.
        </p>
      </div>
    </div>
  );
}
