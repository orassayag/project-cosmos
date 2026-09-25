import { BRAND } from '../scenarios/brand';

/**
 * Small status pill linking to the nightly Drift Sync workflow — the
 * pipeline that keeps this map honest against the real repos. Clicking
 * it opens the latest run summary on GitHub Actions.
 */
export function DriftFooter() {
  return (
    <a
      className="lc-drift-footer"
      href={BRAND.driftSyncUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the latest Drift Sync run on GitHub Actions"
    >
      <span className="lc-drift-footer-dot" aria-hidden="true" />
      <span className="lc-drift-footer-label">Drift Sync</span>
      <svg width={9} height={9} viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M4 2h6v6M10 2 3 9"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
