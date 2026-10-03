import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { startCosmosFetch } from '../api/cosmosClient';
import type { AskAction } from '../components/AskPanel';
import { INTRO_SEEN_STORAGE_KEY } from '../demo/demoMode';
import { MOBILE_QUERY } from '../hooks/useViewport';
import { App } from '../App';
import { COSMOS_FIXTURE } from './renderWithCosmos';

vi.mock('../api/cosmosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/cosmosClient')>()),
  startCosmosFetch: vi.fn(),
}));

vi.mock('../components/WarpTransition', () => ({
  WarpTransition: () => <div data-testid="warp" />,
}));

const { data, derived } = COSMOS_FIXTURE;
const SERVICE = data.services.find((service) => derived.healthStatus.byService[service.id]) ?? data.services[0];
const TOPIC = data.topics.find((topic) => derived.connectedNodeIds.includes(topic.id)) ?? data.topics[0];
// The oldest entry sits past the changelog's first page, so opening it also pages down.
const OLDEST_DRIFT_ENTRY = [...data.drift.entries].sort((first, second) => first.date.localeCompare(second.date))[0];

const SURFACE_SELECTORS = {
  ask: '.lc-ask-panel',
  blast: '.lc-blast-legend',
  passport: '.lc-map-panel',
  health: '.lc-health-legend',
  ownership: '.lc-owner-legend',
  changelog: '.lc-changelog',
} as const;

type Surface = keyof typeof SURFACE_SELECTORS;

/** Surfaces rendered and not hidden — what the visitor can see. */
function visibleSurfaces(): Surface[] {
  return (Object.keys(SURFACE_SELECTORS) as Surface[]).filter((surface) => {
    const element = document.querySelector<HTMLElement>(SURFACE_SELECTORS[surface]);
    return element !== null && !element.hidden;
  });
}

function stubViewport(isPhone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isPhone && query === MOBILE_QUERY,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function stubAgent(action: AskAction) {
  const answer = [{ type: 'token', text: 'Here it is on the map.' }, action, { type: 'done' }]
    .map((event) => JSON.stringify(event))
    .join('\n');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/ai/ask' ? new Response(`${answer}\n`) : Response.json({ connected: true, provider: 'anthropic' }),
    ),
  );
}

async function askWithAgentAction(action: AskAction) {
  stubAgent(action);
  vi.mocked(startCosmosFetch).mockResolvedValue(COSMOS_FIXTURE);
  render(<App />);
  await waitFor(() => expect(document.querySelector('.lc-app')).not.toBeNull());
  const agentButton = screen.getByRole('button', { name: 'Open the agent chat' });
  await waitFor(() => expect(agentButton.classList.contains('lc-agent-button--on')).toBe(true));
  fireEvent.click(agentButton);

  const askInput = screen.getByRole('textbox', { name: 'Your question' });
  fireEvent.change(askInput, { target: { value: 'Show me' } });
  fireEvent.keyDown(askInput, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Here it is on the map.')).toBeTruthy());
  // The stream lands outside act(), so the answer can be on screen before the action's effects have run.
  await act(async () => {});
}

describe('Ask map actions', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    localStorage.clear();
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.mocked(startCosmosFetch).mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('on a phone, each action opens its surface above the answer — one panel at a time', () => {
    beforeEach(() => stubViewport(true));

    it('showBlastRadius opens blast radius for the node; closing it brings the answer back', async () => {
      await askWithAgentAction({ type: 'action', kind: 'showBlastRadius', nodeId: SERVICE.id });

      expect(visibleSurfaces()).toEqual(['blast']);
      expect(document.querySelector('.lc-blast-legend-source-name')?.textContent).toBe(SERVICE.name);

      fireEvent.click(screen.getByRole('button', { name: 'Close blast radius' }));
      expect(visibleSurfaces()).toEqual(['ask']);
      expect(screen.getByText('Here it is on the map.')).toBeTruthy();
    });

    it('openPassport opens the passport of a service', async () => {
      await askWithAgentAction({ type: 'action', kind: 'openPassport', nodeId: SERVICE.id });

      expect(visibleSurfaces()).toEqual(['passport']);
      expect(document.querySelector('.lc-map-panel-title-row h3')?.textContent).toBe(SERVICE.name);
    });

    it('openPassport opens the passport of a topic', async () => {
      await askWithAgentAction({ type: 'action', kind: 'openPassport', nodeId: TOPIC.id });

      expect(visibleSurfaces()).toEqual(['passport']);
      expect(document.querySelector('.lc-map-panel-title-row h3')?.textContent).toBe(TOPIC.name);
    });

    it('showHealth opens the health heat map', async () => {
      await askWithAgentAction({ type: 'action', kind: 'showHealth' });

      expect(visibleSurfaces()).toEqual(['health']);
    });

    it('showOwnership opens the ownership view', async () => {
      await askWithAgentAction({ type: 'action', kind: 'showOwnership' });

      expect(visibleSurfaces()).toEqual(['ownership']);
      expect(document.querySelectorAll('.lc-owner-legend-item')).toHaveLength(derived.ownership.teamGroups.length);
    });

    it('openChangelogEntry opens the changelog at that entry', async () => {
      await askWithAgentAction({ type: 'action', kind: 'openChangelogEntry', entryId: OLDEST_DRIFT_ENTRY.id });

      expect(visibleSurfaces()).toEqual(['changelog']);
      await waitFor(() => {
        const focused = document.querySelector<HTMLElement>('.lc-changelog-item[aria-current="true"]');
        expect(focused?.dataset.entryId).toBe(OLDEST_DRIFT_ENTRY.id);
      });
    });

    it('ignores an action naming an id the map does not have', async () => {
      await askWithAgentAction({ type: 'action', kind: 'showBlastRadius', nodeId: 'no-such-node' });

      expect(visibleSurfaces()).toEqual(['ask']);
    });
  });

  describe('never writes saved state', () => {
    beforeEach(() => stubViewport(false));

    it.each<AskAction>([
      { type: 'action', kind: 'highlight', serviceIds: [SERVICE.id] },
      { type: 'action', kind: 'playScenario', scenarioId: data.scenarios[0].id },
      { type: 'action', kind: 'showBlastRadius', nodeId: SERVICE.id },
      { type: 'action', kind: 'openPassport', nodeId: SERVICE.id },
      { type: 'action', kind: 'showHealth' },
      { type: 'action', kind: 'showOwnership' },
      { type: 'action', kind: 'openChangelogEntry', entryId: OLDEST_DRIFT_ENTRY.id },
    ])('$kind leaves localStorage (and the saved layout) untouched', async (action) => {
      // jsdom has no SVG geometry; playing a scenario measures the comet paths.
      Object.defineProperty(SVGElement.prototype, 'getTotalLength', { value: () => 100, configurable: true });
      Object.defineProperty(SVGElement.prototype, 'getPointAtLength', { value: () => ({ x: 0, y: 0 }), configurable: true });
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
      const clear = vi.spyOn(Storage.prototype, 'clear');

      await askWithAgentAction(action);

      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(localStorage.getItem('cosmos-layout')).toBeNull();
    });
  });

  describe('on desktop', () => {
    beforeEach(() => stubViewport(false));

    it('keeps the answer beneath the blast radius and brings it back when the overlay closes', async () => {
      await askWithAgentAction({ type: 'action', kind: 'showBlastRadius', nodeId: SERVICE.id });

      expect(visibleSurfaces()).toEqual(['blast']);
      fireEvent.keyDown(document.body, { key: 'b' });
      expect(visibleSurfaces()).toEqual(['ask']);
    });

    it('opens the passport beside the answer', async () => {
      await askWithAgentAction({ type: 'action', kind: 'openPassport', nodeId: SERVICE.id });

      expect(visibleSurfaces()).toEqual(['ask', 'passport']);
      expect(document.querySelector('.lc-map-panel')?.classList.contains('lc-map-panel--right')).toBe(true);
    });
  });
});
