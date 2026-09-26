import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { repository } from '../../../package.json';
import { OVERLAY, useOverlay } from '../overlays/OverlayManager';

export const LINKEDIN_URL = 'https://www.linkedin.com/in/orassayag/';

/** `git+https://github.com/owner/repo.git` → `https://github.com/owner/repo`. */
export function toRepositoryWebUrl(repositoryUrl: string): string {
  return repositoryUrl.replace(/^git\+/, '').replace(/\.git$/, '');
}

export const GITHUB_URL = toRepositoryWebUrl(repository.url);

/** The demo's closing credit. Opened by the `endCard` step and left open after the run
 *  ends; the corner close is its only exit besides Esc / backdrop. */
export function DemoEndCard() {
  const overlay = useOverlay();
  if (!overlay.isOpen(OVERLAY.demoEndCard)) return null;
  return createPortal(<DemoEndCardDialog onClose={() => overlay.close(OVERLAY.demoEndCard)} />, document.body);
}

function DemoEndCardDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lc-help-overlay lc-demo-end-overlay" onClick={onClose}>
      <div
        className="lc-help-modal lc-demo-end-card"
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

        <div className="lc-help-eyebrow">Project Cosmos</div>
        <h2 id={titleId} className="lc-help-title lc-demo-end-title">
          <span>Built by Or Assayag</span>
          <span className="lc-demo-end-sep" aria-hidden="true">·</span>
          <a className="lc-demo-end-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="lc-demo-end-sep" aria-hidden="true">·</span>
          <a className="lc-demo-end-link" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </h2>
      </div>
    </div>
  );
}
