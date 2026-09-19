import type { BlastResult } from './blast-radius';
import { BLAST_LEVEL_META } from './blast-radius';
import { SERVICES_BY_ID, TOPICS_BY_ID } from '../scenarios/data';

interface BlastLegendProps {
  /** Result for the current source, or null when nothing is selected yet. */
  result: BlastResult | null;
  /** Display name of the source node (shown in the header). */
  sourceName: string | null;
  /** Fly the map to (and select) a dependent node. */
  onFocus: (nodeId: string) => void;
  /** Clear the selected source. */
  onClear: () => void;
}

/**
 * The "what breaks if I change X" legend (F14). With no source picked it just
 * prompts; once a node is chosen it lists every dependent grouped HIGH → MED →
 * LOW, each row flying the map to that node. The nodes themselves ring in the
 * matching severity color while this overlay is active.
 */
export function BlastLegend({ result, sourceName, onFocus, onClear }: BlastLegendProps) {
  return (
    <div className="lc-blast-legend" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <div className="lc-blast-legend-title">Blast radius</div>

      {!result || !sourceName ? (
        <div className="lc-blast-legend-hint">Click a service or topic to see what breaks if you change it.</div>
      ) : (
        <>
          <div className="lc-blast-legend-source">
            <span
              className="lc-blast-legend-swatch"
              style={{ background: BLAST_LEVEL_META.source.hex }}
              aria-hidden="true"
            />
            <span className="lc-blast-legend-source-name">{sourceName}</span>
            <button type="button" className="lc-blast-legend-clear" onClick={onClear} aria-label="Clear selection">
              Clear
            </button>
          </div>

          {result.dependents.length === 0 ? (
            <div className="lc-blast-legend-hint">
              Nothing else depends on this node — safe to change in isolation.
            </div>
          ) : (
            <>
              <div className="lc-blast-legend-hint">
                {result.dependents.length} dependent{result.dependents.length === 1 ? '' : 's'} — click to fly there
              </div>
              <ul className="lc-blast-legend-list">
                {result.dependents.map((node) => {
                  const isTopic = !!TOPICS_BY_ID[node.id];
                  const sub = SERVICES_BY_ID[node.id]?.role ?? (isTopic ? 'Kafka topic' : '');
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        className="lc-blast-legend-item"
                        onClick={() => onFocus(node.id)}
                        title={sub}
                      >
                        <span
                          className="lc-blast-legend-swatch"
                          style={{ background: BLAST_LEVEL_META[node.level].hex }}
                          aria-hidden="true"
                        />
                        <span className="lc-blast-legend-label">{node.name}</span>
                        <span className="lc-blast-legend-level">{BLAST_LEVEL_META[node.level].label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
