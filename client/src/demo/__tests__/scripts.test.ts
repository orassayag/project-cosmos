import { describe, expect, it } from 'vitest';
import { INCIDENTS } from '../../incidents/data';
import { shotTimelineMs } from '../../map/CometPackets';
import { PLAYABLE_BY_ID, stepsForScenario } from '../../scenarios/data';
import { typingDurationMs } from '../humanMotion';
import { POINTER_MOVE_MS } from '../runDemo';
import { DEMO_QUESTION, DEMO_SCRIPTED_ANSWER } from '../scriptedAnswer';
import {
  ALL_DEMO_SCENARIO_ID,
  buildDemoScript,
  DEMO_TIME_LIMITS_MS,
  playbackDurationMs,
  scriptDurationMs,
  scriptedAnswerDurationMs,
} from '../scripts';
import { DEMO_TARGETS, type DemoModeName, type DemoScript, type DemoTarget } from '../types';

const MODES: DemoModeName[] = ['ai', 'all'];
const LAYOUTS = [{ isPhone: false }, { isPhone: true }];
const VARIANTS = MODES.flatMap((mode) => LAYOUTS.map((layout) => [mode, layout.isPhone ? 'phone' : 'desktop', buildDemoScript(mode, layout)] as const));

function targetsOf(script: DemoScript): DemoTarget[] {
  return script.flatMap((step) => (step.kind === 'wait' ? [] : [step.target]));
}

function isKnownTarget(target: DemoTarget): boolean {
  if ((DEMO_TARGETS as readonly string[]).includes(target)) return true;
  const scenarioId = target.match(/^scenario-(.+)$/)?.[1];
  if (scenarioId) return PLAYABLE_BY_ID[scenarioId] !== undefined;
  const incidentId = target.match(/^incident-(.+)$/)?.[1];
  return incidentId !== undefined && INCIDENTS.some((incident) => incident.id === incidentId);
}

describe('demo scripts', () => {
  it.each(VARIANTS)('keeps the %s demo (%s) within its time limit', (mode, _layout, script) => {
    expect(DEMO_TIME_LIMITS_MS).toEqual({ ai: 60_000, all: 120_000 });
    expect(scriptDurationMs(script)).toBeLessThanOrEqual(DEMO_TIME_LIMITS_MS[mode]);
  });

  it.each(VARIANTS)('points the %s demo (%s) only at known targets', (_mode, _layout, script) => {
    for (const target of targetsOf(script)) expect(isKnownTarget(target), target).toBe(true);
  });

  it.each(VARIANTS)('gives every gesture in the %s demo (%s) time for the pointer glide and its typing', (_mode, _layout, script) => {
    for (const step of script) {
      if (step.kind === 'wait') continue;
      const typingMs = step.kind === 'type' ? typingDurationMs(step.text) : 0;
      expect(step.durationMs, step.target).toBeGreaterThanOrEqual(POINTER_MOVE_MS + typingMs);
    }
  });

  it.each(VARIANTS)('connects with fake keys, types the question and searches in the %s demo (%s)', (_mode, _layout, script) => {
    const connectAt = targetsOf(script).indexOf('connect-submit');
    const typeStep = script.find((step) => step.kind === 'type');
    const searchIndex = script.findIndex((step) => step.kind === 'click' && step.target === 'ask-search');

    expect(connectAt).toBeGreaterThan(-1);
    for (const step of script) {
      if (step.kind === 'paste') expect(step.text).toContain('demo');
    }
    expect(typeStep).toMatchObject({ target: 'ask-input', text: DEMO_QUESTION });
    expect(script[searchIndex + 1]).toMatchObject({ kind: 'wait' });
    expect(script[searchIndex + 1].durationMs).toBeGreaterThanOrEqual(scriptedAnswerDurationMs(DEMO_SCRIPTED_ANSWER));
  });

  it.each(MODES)('opens the phone drawer before the %s demo reaches for a domain', (mode) => {
    const phoneTargets = targetsOf(buildDemoScript(mode, { isPhone: true }));
    const desktopTargets = targetsOf(buildDemoScript(mode, { isPhone: false }));

    expect(desktopTargets).not.toContain('menu-open');
    expect(phoneTargets.indexOf('menu-open')).toBeLessThan(phoneTargets.findIndex((target) => target.startsWith('domain-')));
  });

  it.each(MODES)('ends the %s demo without an end card', (mode) => {
    const script = buildDemoScript(mode, { isPhone: false });
    expect(script[script.length - 1].kind).toBe('wait');
  });
});

describe('demo=all script', () => {
  const script = buildDemoScript('all', { isPhone: false });
  const targets = targetsOf(script);

  it('opens with the intro button', () => {
    expect(script[0]).toMatchObject({ kind: 'click', target: 'intro-start' });
  });

  it('picks the scenario and the newest incident from their menus, then presses Play for their full length', () => {
    const incidentId = INCIDENTS[0].id;
    for (const [pickTarget, playableId] of [[`scenario-${ALL_DEMO_SCENARIO_ID}`, ALL_DEMO_SCENARIO_ID], [`incident-${incidentId}`, incidentId]]) {
      const pickIndex = targets.indexOf(pickTarget as DemoTarget);
      expect(pickIndex, pickTarget).toBeGreaterThan(-1);
      const playStep = script.filter((step) => step.kind !== 'wait')[pickIndex + 1];
      expect(playStep).toMatchObject({ target: 'playback-play' });
      expect(playStep.durationMs).toBeGreaterThanOrEqual(playbackDurationMs(playableId) + POINTER_MOVE_MS);
    }
    expect(targets.indexOf('incidents-open')).toBe(targets.indexOf(`incident-${incidentId}`) - 1);
  });

  it('steps back twice and forward twice', () => {
    expect(targets.filter((target) => target === 'playback-step-back')).toHaveLength(2);
    expect(targets.filter((target) => target === 'playback-step-forward')).toHaveLength(2);
  });

  it('turns the ownership legend on and back off', () => {
    expect(targets.filter((target) => target === 'legend-ownership')).toHaveLength(2);
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
});
