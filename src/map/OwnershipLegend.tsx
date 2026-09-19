import type { TeamGroup } from '../scenarios/owners';

/** Stable key for a group — its team id, or a sentinel for the unowned bucket. */
export function groupKey(group: TeamGroup): string {
  return group.teamId ?? '__unowned__';
}

interface OwnershipLegendProps {
  groups: TeamGroup[];
  /** Key of the currently highlighted team, or null when none is filtered. */
  activeKey: string | null;
  onToggle: (key: string) => void;
}

export function OwnershipLegend({ groups, activeKey, onToggle }: OwnershipLegendProps) {
  return (
    <div className="lc-owner-legend" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <div className="lc-owner-legend-title">Ownership</div>
      <div className="lc-owner-legend-hint">
        {activeKey ? 'Click again to clear' : 'Click a team to isolate it'}
      </div>
      <ul className="lc-owner-legend-list">
        {groups.map((group) => {
          const key = groupKey(group);
          const active = activeKey === key;
          const dimmed = activeKey !== null && !active;
          return (
            <li key={key}>
              <button
                type="button"
                className="lc-owner-legend-item"
                data-active={active ? 'true' : 'false'}
                data-dimmed={dimmed ? 'true' : 'false'}
                onClick={() => onToggle(key)}
                aria-pressed={active}
              >
                <span className="lc-owner-legend-swatch" style={{ background: group.hex }} />
                <span className="lc-owner-legend-label">{group.label}</span>
                <span className="lc-owner-legend-count">{group.serviceIds.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
