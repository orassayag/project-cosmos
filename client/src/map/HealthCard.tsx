import { HEALTH_BY_SERVICE, HEALTH_STATUS_META } from '../scenarios/health';
import { SERVICES_BY_ID } from '../scenarios/data';

interface HealthCardProps {
  serviceId: string;
  onClose: () => void;
}

/** "Aug 11" from an ISO date, in UTC to match the snapshot stamp. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "N days ago" / "yesterday" / "today" from a whole-day count. */
function ago(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "18:00" (UTC) from an ISO datetime. */
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

/** Slack deep link for a channel like "#team-shopping". */
function slackUrl(channel: string): string {
  return `https://slack.com/app_redirect?channel=${channel.replace(/^#/, '')}`;
}

/**
 * On-call card (F17). Opens when a star is clicked in the health overlay:
 * how stale the service is, its PR backlog, and who to page — with a Slack
 * jump. Repo-less infra (object-storage) has no health row, so nothing opens.
 */
export function HealthCard({ serviceId, onClose }: HealthCardProps) {
  const health = HEALTH_BY_SERVICE.get(serviceId);
  const service = SERVICES_BY_ID[serviceId];
  if (!health || !service) return null;

  const meta = HEALTH_STATUS_META[health.status];

  return (
    <div className="lc-health-card" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <button className="lc-health-card-close" onClick={onClose} aria-label="Close">
        <svg width={13} height={13} viewBox="0 0 14 14">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </button>

      <div className="lc-health-card-head">
        <span className="lc-health-card-swatch" style={{ background: meta.hex }} aria-hidden="true" />
        <span className="lc-health-card-name">{service.name}</span>
        <span className="lc-health-card-badge" style={{ color: meta.hex, borderColor: meta.hex }}>
          {meta.label}
        </span>
      </div>

      <dl className="lc-health-card-stats">
        <div>
          <dt>Last commit</dt>
          <dd title={shortDate(health.lastCommit)}>{ago(health.ageDays)}</dd>
        </div>
        <div>
          <dt>Open PRs</dt>
          <dd>{health.openPrs}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{health.teamLabel}</dd>
        </div>
      </dl>

      {health.onCall ? (
        <div className="lc-health-card-oncall">
          <div className="lc-health-card-oncall-line">
            <span className="lc-health-card-oncall-handle">{health.onCall.handle}</span>
            {' is on call until '}
            <span className="lc-health-card-oncall-until" title={`${clock(health.onCall.until)} UTC`}>
              {clock(health.onCall.until)}
            </span>
          </div>
          <a
            className="lc-health-card-slack"
            href={slackUrl(health.onCall.slack)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Message {health.onCall.slack} on Slack
          </a>
        </div>
      ) : (
        <div className="lc-health-card-oncall lc-health-card-oncall--none">
          Platform infra — no on-call rotation.
        </div>
      )}
    </div>
  );
}
