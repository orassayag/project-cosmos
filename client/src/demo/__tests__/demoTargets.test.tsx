import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskAgent } from '../../components/AskAgent';
import { ConnectAgentModal } from '../../components/ConnectAgentModal';
import { DomainBar } from '../../components/DomainBar';
import { IncidentBar } from '../../components/IncidentBar';
import { IntroOverlay } from '../../components/IntroOverlay';
import { MobileMenu } from '../../components/MobileMenu';
import { PlaybackControls } from '../../components/PlaybackControls';
import { ProjectCosmosMap } from '../../map/Map';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import type { RunnerApi } from '../../scenarios/runner';
import type { Scenario, Step } from '../../scenarios/types';
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
      <button type="button" onClick={() => overlay.open(OVERLAY.connect)}>Open connect</button>
      <IntroOverlay onStart={vi.fn()} onExitComplete={vi.fn()} />
      {/* Stand-ins for App's own buttons: the brand reset and the phone menu toggle. */}
      <button type="button" data-demo-target="galaxy-reset">Project Cosmos</button>
      <button type="button" data-demo-target="menu-open">Open menu</button>
      <MobileMenu open onClose={vi.fn()}>menu</MobileMenu>
      <DomainBar active="shopping" activeScenarioId={null} onPickDomain={vi.fn()} onPickScenario={vi.fn()} />
      <IncidentBar activeScenarioId={null} onPickIncident={vi.fn()} />
      <AskAgent
        onAsk={vi.fn()}
        aiStatus="disconnected"
        aiProvider={null}
        onConnectRequest={vi.fn()}
        onDisconnect={vi.fn()}
      />
      <ConnectAgentModal currentProvider={null} onConnect={vi.fn()} />
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
  render(<DemoSurfaces />);
  fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));
  // The menus and the Ask footer only render once opened, as they do for the demo's own clicks.
  fireEvent.click(findTargets('domain-shopping')[0]);
  fireEvent.click(findTargets('incidents-open')[0]);
  fireEvent.focus(findTargets('ask-input')[0]);
}

function findTargets(target: string) {
  return document.querySelectorAll(`[data-demo-target="${target}"]`);
}

describe('data-demo-target attributes', () => {
  it.each([
    ['ai', false], ['ai', true], ['all', false], ['all', true],
  ] as const)('resolves every target the %s demo script (phone: %s) points at to exactly one element', (mode, isPhone) => {
    renderDemoSurfaces();

    const script = buildDemoScript(mode, { isPhone });
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

  it('gives each provider and domain button its own id', () => {
    renderDemoSurfaces();

    expect(findTargets('connect-provider-anthropic')[0].textContent).toBe('Claude');
    expect(findTargets('connect-provider-openai')[0].getAttribute('role')).toBe('radio');
    expect(findTargets('domain-fulfillment')[0].textContent).toContain('Fulfillment');
    expect(findTargets('ask-search')[0].textContent).toBe('Search');
    expect(findTargets('connect-submit')[0].getAttribute('type')).toBe('submit');
    expect(findTargets('legend-ownership')[0].textContent).toBe('Ownership');
  });
});
