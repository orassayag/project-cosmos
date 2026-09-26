import { afterEach, describe, expect, it, vi } from 'vitest';
import { INCIDENTS } from '../../incidents/data';
import { shotTimelineMs } from '../../map/CometPackets';
import { PLAYABLE_BY_ID, stepsForScenario } from '../../scenarios/data';
import { runDemo } from '../runDemo';
import { DEMO_SCRIPTED_ANSWER } from '../scriptedAnswer';
import {
  AI_DEMO_SCRIPT,
  ALL_DEMO_SCENARIO_ID,
  ALL_DEMO_SCRIPT,
  DEMO_SCRIPTS,
  DEMO_TIME_LIMITS_MS,
  playbackDurationMs,
  scriptDurationMs,
  scriptedAnswerDurationMs,
} from '../scripts';
import { DEMO_STEP_ACTIONS, DEMO_STEP_KINDS, DEMO_TARGETS, type DemoActions, type DemoModeName } from '../types';

const ACTION_NAMES = [
  'pressIntro', 'pickDomain', 'setQuestion', 'openConnect', 'pickProvider', 'setConnectField',
  'setAiStatus', 'closeConnect', 'setSearchPressed', 'ask', 'playAnswer', 'playScenario',
  'stepBack', 'stepForward', 'openIncident', 'toggleLegend', 'showEndCard',
] as const satisfies readonly (keyof DemoActions)[];

const scriptEntries = Object.entries(DEMO_SCRIPTS).map(
  ([mode, script]) => [mode as DemoModeName, script] as const,
);

function createActionSpies(): DemoActions {
  return Object.fromEntries(ACTION_NAMES.map((name) => [name, vi.fn()])) as unknown as DemoActions;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('demo scripts', () => {
  it('keeps the ai demo within 60 seconds', () => {
    expect(DEMO_TIME_LIMITS_MS.ai).toBe(60_000);
    expect(scriptDurationMs(AI_DEMO_SCRIPT)).toBeLessThanOrEqual(60_000);
  });

  it('keeps the all demo within 120 seconds', () => {
    expect(DEMO_TIME_LIMITS_MS.all).toBe(120_000);
    expect(scriptDurationMs(ALL_DEMO_SCRIPT)).toBeLessThanOrEqual(120_000);
  });

  it.each(scriptEntries)('keeps the %s demo within its time limit', (mode, script) => {
    expect(scriptDurationMs(script)).toBeLessThanOrEqual(DEMO_TIME_LIMITS_MS[mode]);
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
    const actions = createActionSpies();

    const run = runDemo(AI_DEMO_SCRIPT, actions, { signal: new AbortController().signal, speed: 1 });
    await vi.advanceTimersByTimeAsync(scriptDurationMs(AI_DEMO_SCRIPT));

    await expect(run).resolves.toBe('done');
    expect(actions.playAnswer).toHaveBeenCalledOnce();
    expect(actions.showEndCard).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('demo=all script', () => {
  it('opens with the intro button and ends on the end card', () => {
    expect(ALL_DEMO_SCRIPT[0]).toMatchObject({ kind: 'pressIntro', target: 'intro-start' });
    expect(ALL_DEMO_SCRIPT[ALL_DEMO_SCRIPT.length - 1].kind).toBe('endCard');
  });

  it('gives the scenario and the incident their playback length from the step data', () => {
    const scenarioStep = ALL_DEMO_SCRIPT.find((step) => step.kind === 'playScenario');
    const incidentStep = ALL_DEMO_SCRIPT.find((step) => step.kind === 'openIncident');

    expect(scenarioStep).toMatchObject({ scenarioId: ALL_DEMO_SCENARIO_ID, durationMs: playbackDurationMs(ALL_DEMO_SCENARIO_ID) });
    expect(incidentStep).toMatchObject({ incidentId: INCIDENTS[0].id, durationMs: playbackDurationMs(INCIDENTS[0].id) });
  });

  it('sums every shot of the scenario into its playback length', () => {
    const shotLengthsMs = stepsForScenario(PLAYABLE_BY_ID[ALL_DEMO_SCENARIO_ID])
      .filter((step) => !step.parallel)
      .map((step) => shotTimelineMs([step]));

    expect(shotLengthsMs.length).toBeGreaterThan(1);
    const leadStepsTotalMs = shotLengthsMs.reduce((totalMs, shotMs) => totalMs + shotMs, 0);
    expect(playbackDurationMs(ALL_DEMO_SCENARIO_ID)).toBeGreaterThanOrEqual(leadStepsTotalMs);
    expect(() => playbackDurationMs('no-such-scenario')).toThrow('no-such-scenario');
  });

  it('turns the ownership legend on and back off', () => {
    const legendVisibility = ALL_DEMO_SCRIPT.flatMap((step) => (step.kind === 'toggleLegend' ? [step.isVisible] : []));
    expect(legendVisibility).toEqual([true, false]);
  });

  it('gives the shortened ai answer its full reveal time', () => {
    const answerStep = ALL_DEMO_SCRIPT.find((step) => step.kind === 'answer');
    expect(answerStep?.durationMs).toBeGreaterThanOrEqual(scriptedAnswerDurationMs(DEMO_SCRIPTED_ANSWER));
  });

  it('plays the whole all demo through each tour action without a network request', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const actions = createActionSpies();

    const run = runDemo(ALL_DEMO_SCRIPT, actions, { signal: new AbortController().signal, speed: 1 });
    await vi.advanceTimersByTimeAsync(scriptDurationMs(ALL_DEMO_SCRIPT));

    await expect(run).resolves.toBe('done');
    expect(actions.pressIntro).toHaveBeenCalledOnce();
    expect(actions.playScenario).toHaveBeenCalledWith(ALL_DEMO_SCENARIO_ID);
    expect(actions.stepBack).toHaveBeenCalledTimes(2);
    expect(actions.stepForward).toHaveBeenCalledTimes(2);
    expect(actions.openIncident).toHaveBeenCalledWith(INCIDENTS[0].id);
    expect(vi.mocked(actions.toggleLegend).mock.calls).toEqual([[true], [false]]);
    expect(actions.showEndCard).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
