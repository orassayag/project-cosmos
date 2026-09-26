import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskAgent } from '../../components/AskAgent';
import { ConnectAgentModal } from '../../components/ConnectAgentModal';
import { DomainBar } from '../../components/DomainBar';
import { IntroOverlay } from '../../components/IntroOverlay';
import { PlaybackControls } from '../../components/PlaybackControls';
import { ProjectCosmosMap } from '../../map/Map';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import type { RunnerApi } from '../../scenarios/runner';
import type { Scenario, Step } from '../../scenarios/types';
import { DEMO_SCRIPTS } from '../scripts';
import { DEMO_TARGETS, type DemoConnectState } from '../types';

const DEMO_CONNECT_STATE: DemoConnectState = {
  provider: 'anthropic',
  providerKey: 'sk-ant-demo-••••••••',
  jevKey: 'vck-demo-••••••••',
  showJevField: true,
  isBusy: false,
};

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
      <DomainBar active="shopping" activeScenarioId={null} onPickDomain={vi.fn()} onPickScenario={vi.fn()} />
      <AskAgent
        onAsk={vi.fn()}
        aiStatus="disconnected"
        aiProvider={null}
        onConnectRequest={vi.fn()}
        onDisconnect={vi.fn()}
        demoQuestion="Which services does checkout touch?"
        demoExpanded
      />
      <ConnectAgentModal currentProvider={null} onConnect={vi.fn()} demo={DEMO_CONNECT_STATE} />
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
}

function findTargets(target: string) {
  return document.querySelectorAll(`[data-demo-target="${target}"]`);
}

describe('data-demo-target attributes', () => {
  it.each(Object.entries(DEMO_SCRIPTS))('resolves every target the %s demo script points at to exactly one element', (_mode, script) => {
    renderDemoSurfaces();

    const scriptTargets = script.flatMap((step) => (step.target ? [step.target] : []));
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
