import { describe, expect, it } from 'vitest';
import { indexCosmos, stepsFor } from '../../api/cosmosIndex';
import { shotTimelineMs } from '../../map/CometPackets';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { typingDurationMs } from '../humanMotion';
import { POINTER_MOVE_MS } from '../runDemo';
import { buildDemoScriptedAnswer } from '../scriptedAnswer';
import {
  buildDemoScript as buildDemoScriptFor,
  DEMO_TIME_LIMITS_MS,
  playbackDurationMs as playbackDurationMsFor,
  scriptDurationMs,
  scriptedAnswerDurationMs,
} from '../scripts';
import { DEMO_TARGETS, type DemoModeName, type DemoScript, type DemoTarget } from '../types';
import type { DemoLayout } from '../scripts';

const { playableById: PLAYABLE_BY_ID } = indexCosmos(COSMOS_FIXTURE);
const { allTour, aiTour } = COSMOS_FIXTURE.data.demo;
const ALL_DEMO_SCENARIO_ID = allTour.scenarioId;
const DOMAIN_IDS = COSMOS_FIXTURE.data.domains.map((domain) => domain.id);
const buildDemoScript = (mode: DemoModeName, layout: DemoLayout) => buildDemoScriptFor(COSMOS_FIXTURE, mode, layout);
const playbackDurationMs = (playableId: string) => playbackDurationMsFor(COSMOS_FIXTURE, playableId);
const INCIDENTS = COSMOS_FIXTURE.data.incidents;
const MODES: DemoModeName[] = ['ai', 'all'];
const LAYOUTS = [{ isPhone: false }, { isPhone: true }];
const VARIANTS = MODES.flatMap((mode) => LAYOUTS.map((layout) => [mode, layout.isPhone ? 'phone' : 'desktop', buildDemoScript(mode, layout)] as const));

function targetsOf(script: DemoScript): DemoTarget[] {
  return script.flatMap((step) => (step.kind === 'wait' ? [] : [step.target]));
}

function isKnownTarget(target: DemoTarget): boolean {
  if ((DEMO_TARGETS as readonly string[]).includes(target)) return true;
  const domainId = target.match(/^domain-(.+)$/)?.[1];
  if (domainId) return DOMAIN_IDS.includes(domainId);
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

  it.each(VARIANTS)('opens the agent bot, types the question and searches in the %s demo (%s)', (_mode, layout, script) => {
    const targets = targetsOf(script);
    const typeStep = script.find((step) => step.kind === 'type');
    const searchIndex = script.findIndex((step) => step.kind === 'click' && step.target === 'ask-search');

    expect(targets.indexOf('connect-open')).toBeGreaterThan(-1);
    expect(targets.indexOf('connect-open')).toBeLessThan(targets.indexOf('ask-input'));
    expect(script.some((step) => step.kind === 'paste')).toBe(false);
    expect(typeStep).toMatchObject({ target: 'ask-input', text: aiTour.question });
    expect(script[searchIndex + 1]).toMatchObject({ kind: 'wait' });
    const answer = buildDemoScriptedAnswer(aiTour, { isPhone: layout === 'phone' });
    expect(script[searchIndex + 1].durationMs).toBeGreaterThanOrEqual(scriptedAnswerDurationMs(answer));
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
    expect(allTour.incidentId).toBe(incidentId);
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

  it('browses the scenario\'s domain, the tour\'s other domain, then the scenario\'s domain again', () => {
    const scenarioDomain = `domain-${PLAYABLE_BY_ID[ALL_DEMO_SCENARIO_ID].domain}`;
    expect(targets.filter((target) => target.startsWith('domain-'))).toEqual([
      scenarioDomain,
      `domain-${allTour.browseDomainId}`,
      scenarioDomain,
    ]);
  });

  it('skips the incident replay when the tour names no incident', () => {
    const withoutIncident = { ...COSMOS_FIXTURE, data: { ...COSMOS_FIXTURE.data, demo: { ...COSMOS_FIXTURE.data.demo, allTour: { ...allTour, incidentId: null } } } };
    const phoneTargets = targetsOf(buildDemoScriptFor(withoutIncident, 'all', { isPhone: true }));

    expect(phoneTargets.filter((target) => target === 'incidents-open' || target.startsWith('incident-'))).toEqual([]);
    expect(phoneTargets.filter((target) => target === 'menu-open')).toHaveLength(1);
  });

  it('turns the ownership legend on and back off', () => {
    expect(targets.filter((target) => target === 'legend-ownership')).toHaveLength(2);
  });

  it('sums every shot of the scenario into its playback length', () => {
    const shotLengthsMs = stepsFor(COSMOS_FIXTURE, ALL_DEMO_SCENARIO_ID)
      .filter((step) => !step.parallel)
      .map((step) => shotTimelineMs([step]));

    expect(shotLengthsMs.length).toBeGreaterThan(1);
    const leadStepsTotalMs = shotLengthsMs.reduce((totalMs, shotMs) => totalMs + shotMs, 0);
    expect(playbackDurationMs(ALL_DEMO_SCENARIO_ID)).toBeGreaterThanOrEqual(leadStepsTotalMs);
    expect(() => playbackDurationMs('no-such-scenario')).toThrow('no-such-scenario');
  });
});
