import { useEffect, useRef, useState } from 'react';

import { INCIDENTS, stepsForScenario } from '../scenarios/data';

interface IncidentBarProps {
  /** Currently selected playable id — highlights the active incident. */
  activeScenarioId: string | null;
  onPickIncident: (incidentId: string) => void;
  /** Bumped by a galaxy reset ("Cosmos" title / global Esc) to close the menu. */
  resetNonce?: number;
}

/**
 * "Incidents" trigger + dropdown. Lists every recorded incident newest-first
 * (INCIDENTS is pre-sorted); picking one loads it into the shared player via
 * the same path a scenario takes. Styled to match the DomainBar menu so an
 * incident feels like a sibling of a scenario, not a separate tool.
 */
export function IncidentBar({ activeScenarioId, onPickIncident, resetNonce = 0 }: IncidentBarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A galaxy reset collapses the incidents dropdown so the trigger stays neutral.
  useEffect(() => {
    if (resetNonce === 0) return;
    setOpen(false);
  }, [resetNonce]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeIsIncident = INCIDENTS.some((i) => i.id === activeScenarioId);

  return (
    <div className="lc-domain-bar lc-incident-bar" ref={wrapRef}>
      <button
        type="button"
        className="lc-present-btn lc-incident-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={activeIsIncident ? 'true' : 'false'}
        data-open={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        title="Replay a recorded production incident"
      >
        <span className="lc-incident-trigger-dot" aria-hidden="true" />
        Incidents
        <span className="lc-domain-tab-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="lc-domain-menu lc-incident-menu" role="menu" style={{ left: 0, minWidth: 300 }}>
          <div className="lc-picker-menu-hdr">
            {INCIDENTS.length} recorded incident{INCIDENTS.length === 1 ? '' : 's'}
          </div>
          {INCIDENTS.length === 0 && (
            <div className="lc-picker-menu-empty">No incidents recorded yet.</div>
          )}
          {INCIDENTS.map((incident) => {
            const stepCount = stepsForScenario(incident).length;
            const isActive = incident.id === activeScenarioId;
            return (
              <button
                key={incident.id}
                type="button"
                className="lc-picker-item"
                data-ready="true"
                data-active={isActive ? 'true' : 'false'}
                style={{ ['--c' as string]: incident.color } as React.CSSProperties}
                onClick={() => {
                  onPickIncident(incident.id);
                  setOpen(false);
                }}
              >
                <span className="lc-picker-item-swatch" />
                <span className="lc-picker-item-body">
                  <span className="lc-picker-item-label">{incident.label}</span>
                  <span className="lc-picker-item-sub">
                    {incident.date} · {stepCount} hop{stepCount === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="lc-picker-item-badge lc-incident-item-badge">INCIDENT</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
