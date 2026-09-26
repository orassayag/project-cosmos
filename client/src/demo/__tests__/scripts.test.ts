import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDemo } from '../runDemo';
import { AI_DEMO_SCRIPT, DEMO_SCRIPTS, DEMO_TIME_LIMITS_MS, scriptDurationMs } from '../scripts';
import { DEMO_STEP_ACTIONS, DEMO_STEP_KINDS, DEMO_TARGETS, type DemoActions, type DemoModeName } from '../types';

const ACTION_NAMES = [
  'pressIntro', 'pickDomain', 'setQuestion', 'openConnect', 'pickProvider', 'setConnectField',
  'setAiStatus', 'closeConnect', 'setSearchPressed', 'ask', 'playAnswer', 'playScenario',
  'stepBack', 'stepForward', 'openIncident', 'toggleLegend', 'showEndCard',
] as const satisfies readonly (keyof DemoActions)[];

const scriptEntries = Object.entries(DEMO_SCRIPTS).map(
  ([mode, script]) => [mode as DemoModeName, script!] as const,
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('demo scripts', () => {
  it('keeps the ai demo within 60 seconds', () => {
    expect(DEMO_TIME_LIMITS_MS.ai).toBe(60_000);
    expect(scriptDurationMs(AI_DEMO_SCRIPT)).toBeLessThanOrEqual(60_000);
  });

  it.each(scriptEntries)('keeps the %s demo within its time limit', (mode, script) => {
    const limitMs = DEMO_TIME_LIMITS_MS[mode];
    expect(limitMs).toBeDefined();
    expect(scriptDurationMs(script)).toBeLessThanOrEqual(limitMs!);
  });

  it('maps every step kind to real DemoActions callbacks', () => {
    for (const kind of DEMO_STEP_KINDS) {
      for (const actionName of DEMO_STEP_ACTIONS[kind]) expect(ACTION_NAMES).toContain(actionName);
    }
    for (const [, script] of scriptEntries) {
      for (const step of script) expect(DEMO_STEP_ACTIONS[step.kind], step.kind).toBeDefined();
    }
  });

  it.each(scriptEntries)('points the %s demo only at known targets', (_mode, script) => {
    for (const step of script) {
      if (step.target !== undefined) expect(DEMO_TARGETS).toContain(step.target);
    }
  });

  it('plays the whole ai demo without a network request', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const actions = Object.fromEntries(ACTION_NAMES.map((name) => [name, vi.fn()])) as unknown as DemoActions;

    const run = runDemo(AI_DEMO_SCRIPT, actions, { signal: new AbortController().signal, speed: 1 });
    await vi.advanceTimersByTimeAsync(scriptDurationMs(AI_DEMO_SCRIPT));

    await expect(run).resolves.toBe('done');
    expect(actions.playAnswer).toHaveBeenCalledOnce();
    expect(actions.showEndCard).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
