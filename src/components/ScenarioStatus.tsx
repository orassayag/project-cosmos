import { SCENARIOS_BY_ID, INCIDENTS_BY_ID, INCIDENT_COMET_HEX, scenariosForDomain } from '../scenarios/data';

interface ScenarioStatusProps {
  domainId: string;
  activeScenarioId: string | null;
}

/**
 * Read-only chip that shows what's currently playing — the selected scenario,
 * a recorded incident, or a placeholder when nothing is picked. Picking one
 * happens via the DomainBar / Incidents dropdowns; this is just a status
 * indicator, not a control.
 */
export function ScenarioStatus({ domainId, activeScenarioId }: ScenarioStatusProps) {
  // An incident replay wins over the scenario lookup — its id lives in the same
  // runner slot but isn't a member of any domain's scenario list, so without
  // this it would fall through to "No scenario selected" while clearly playing.
  const incident = activeScenarioId ? INCIDENTS_BY_ID[activeScenarioId] ?? null : null;
  const scenario = activeScenarioId ? SCENARIOS_BY_ID[activeScenarioId] ?? null : null;
  const isActiveInDomain = scenario?.domain === domainId;
  const scenarios = scenariosForDomain(domainId);

  const active = incident != null || isActiveInDomain;
  const label = incident
    ? incident.label
    : isActiveInDomain
      ? scenario!.label
      : domainId && scenarios.length === 0
        ? 'No scenarios yet'
        : 'No scenario selected';
  const swatch = incident
    ? INCIDENT_COMET_HEX
    : isActiveInDomain
      ? scenario!.color
      : 'var(--text-3)';

  return (
    <div
      className="lc-scenario-status"
      data-active={active ? 'true' : 'false'}
      data-incident={incident != null ? 'true' : 'false'}
      style={{ ['--c' as string]: swatch } as React.CSSProperties}
      aria-live="polite"
    >
      <span className="lc-scenario-status-dot" />
      <span className="lc-scenario-status-label">{label}</span>
    </div>
  );
}
