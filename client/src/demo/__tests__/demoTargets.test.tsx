import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { AgentButton } from '../../components/AgentButton';
import { AskPanel } from '../../components/AskPanel';
import { DomainBar } from '../../components/DomainBar';
import { IncidentBar } from '../../components/IncidentBar';
import { IntroOverlay } from '../../components/IntroOverlay';
import { MobileMenu } from '../../components/MobileMenu';
import { PlaybackControls } from '../../components/PlaybackControls';
import { ProjectCosmosMap } from '../../map/Map';
import { OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import type { RunnerApi } from '../../player/runner';
import type { Scenario, Step } from '../../api/cosmos-api';
import { COSMOS_FIXTURE, renderWithCosmos } from '../../__tests__/renderWithCosmos';
import { buildDemoScript } from '../scripts';
import { DEMO_TARGETS } from '../types';

const STUB_STEPS = [{ label: 'First' }, { label: 'Second' }, { label: 'Third' }] as Step[];

const STUB_RUNNER = {
  state: { scenarioId: 'shopping.place-order', idx: 1, playing: false, speed: 1, loop: false },
  steps: STUB_STEPS,
  scenario: {} as Scenario,
  pause: vi.fn(),
  setSpeed: vi.fn(),
} as unknown as RunnerApi;

function DemoSurfaces() {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <IntroOverlay onStart={vi.fn()} onExitComplete={vi.fn()} />
      {/* Stand-ins for App's own buttons: the brand reset and the phone menu toggle. */}
      <button type="button" data-demo-target="galaxy-reset">Project Cosmos</button>
      <button type="button" data-demo-target="menu-open">Open menu</button>
      <MobileMenu open onClose={vi.fn()}>menu</MobileMenu>
      <DomainBar active="shopping" activeScenarioId={null} onPickDomain={vi.fn()} onPickScenario={vi.fn()} />
      <IncidentBar activeScenarioId={null} onPickIncident={vi.fn()} />
      <AgentButton status="connected" provider="anthropic" onOpenChat={vi.fn()} onOpenSetup={vi.fn()} />
      {/* The panel the green bot opens, before anything is asked. */}
      <AskPanel question="" onAsk={vi.fn()} onClose={vi.fn()} />
      <PlaybackControls
        runner={STUB_RUNNER}
        steps={STUB_STEPS}
        onPlay={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onJump={vi.fn()}
        onRestart={vi.fn()}
      />
      <ProjectCosmosMap />
    </OverlayProvider>
  );
}

function renderDemoSurfaces() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  renderWithCosmos(<DemoSurfaces />);
  // The menus only render once opened, as they do for the demo's own clicks.
  fireEvent.click(findTargets('domain-shopping')[0]);
  fireEvent.click(findTargets('incidents-open')[0]);
}

function findTargets(target: string) {
  return document.querySelectorAll(`[data-demo-target="${target}"]`);
}

describe('data-demo-target attributes', () => {
  it.each([
    ['ai', false], ['ai', true], ['all', false], ['all', true],
  ] as const)('resolves every target the %s demo script (phone: %s) points at to exactly one element', (mode, isPhone) => {
    renderDemoSurfaces();

    const script = buildDemoScript(COSMOS_FIXTURE, mode, { isPhone });
    const scriptTargets = script.flatMap((step) => (step.kind === 'wait' ? [] : [step.target]));
    expect(scriptTargets.length).toBeGreaterThan(0);
    for (const target of scriptTargets) {
      expect(findTargets(target), target).toHaveLength(1);
    }
  });

  it('marks every known target on the element the pointer should click', () => {
    renderDemoSurfaces();

    for (const target of DEMO_TARGETS) {
      const matches = findTargets(target);
      expect(matches, target).toHaveLength(1);
      expect(['BUTTON', 'INPUT', 'TEXTAREA'], target).toContain(matches[0].tagName);
    }
  });

  it('marks every domain button', () => {
    renderDemoSurfaces();

    for (const domain of COSMOS_FIXTURE.data.domains) expect(findTargets(`domain-${domain.id}`), domain.id).toHaveLength(1);
  });

  it('gives the agent bot and each domain button its own id', () => {
    renderDemoSurfaces();

    expect(findTargets('connect-open')[0].getAttribute('aria-label')).toBe('Open the agent chat');
    expect(findTargets('domain-fulfillment')[0].textContent).toContain('Fulfillment');
    expect(findTargets('ask-search')[0].textContent).toBe('Search');
    expect(findTargets('legend-ownership')[0].textContent).toBe('Ownership');
  });
});
