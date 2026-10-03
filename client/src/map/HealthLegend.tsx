import type { HealthStatus } from '../api/cosmos-api';
import { useCosmos } from '../api/CosmosProvider';
import { HEALTH_STATUS_META } from '../theme/statusMeta';
import { PanelCloseButton } from '../components/PanelCloseButton';

const ORDER: HealthStatus[] = ['fresh', 'warm', 'hot'];

interface HealthLegendProps {
  /** Close the overlay (mobile corner ×). */
  onClose?: () => void;
}

/**
 * Heat-map key (F17). Explains what each star tint means and how many services
 * sit in each bucket. Read-only — the map does the talking; clicking a star
 * opens the on-call card.
 */
export function HealthLegend({ onClose }: HealthLegendProps) {
  const statusCounts = useCosmos().derived.healthStatus.counts;
  return (
    <div className="lc-health-legend" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      {onClose && <PanelCloseButton onClose={onClose} label="Close health" />}
      <div className="lc-health-legend-title">Service health</div>
      <div className="lc-health-legend-hint">Tint = commit age + PR backlog</div>
      <ul className="lc-health-legend-list">
        {ORDER.map((status) => {
          const meta = HEALTH_STATUS_META[status];
          return (
            <li key={status} className="lc-health-legend-item">
              <span
                className="lc-health-legend-swatch"
                style={{ background: meta.hex }}
                aria-hidden="true"
              />
              <span className="lc-health-legend-label">
                {meta.label}
                <span className="lc-health-legend-blurb">{meta.blurb}</span>
              </span>
              <span className="lc-health-legend-count">{statusCounts[status]}</span>
            </li>
          );
        })}
      </ul>
      <div className="lc-health-legend-foot">Click a star for on-call</div>
    </div>
  );
}
