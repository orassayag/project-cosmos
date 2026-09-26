import { INCIDENTS } from '../incidents/data';
import { shotTimelineMs } from '../map/CometPackets';
import { PLAYABLE_BY_ID, stepsForScenario } from '../scenarios/data';
import type { Step } from '../scenarios/types';
import { DEMO_QUESTION, DEMO_SCRIPTED_ANSWER } from './scriptedAnswer';
import type { DemoModeName, DemoScript, DemoScriptedAnswer, DemoStep } from './types';

/** Obviously fake keys: the demo only shows them being pasted, nothing is ever sent. */
const DEMO_CLAUDE_KEY = 'sk-ant-demo-astromart-0000';
const DEMO_JEV_KEY = 'jev-demo-astromart-0000';

/** Allowance for the React commits between one shot's timeline ending and the next one starting. */
const SHOT_HANDOFF_MS = 100;

export const DEMO_TIME_LIMITS_MS: Record<DemoModeName, number> = {
  ai: 60_000,
  all: 120_000,
};

export const AI_DEMO_SCRIPT: DemoScript = [
  { kind: 'wait', durationMs: 800 },
  { kind: 'pickDomain', domainId: 'shopping', durationMs: 1200, target: 'domain-shopping', caption: 'Exploring the Shopping domain' },
  { kind: 'type', text: DEMO_QUESTION, durationMs: 4000, target: 'ask-input', caption: 'Asking the map a question' },
  { kind: 'wait', durationMs: 600 },
  { kind: 'openConnect', durationMs: 1100, target: 'connect-open', caption: 'Connecting an AI agent' },
  { kind: 'pickProvider', provider: 'anthropic', durationMs: 600, target: 'connect-provider-anthropic' },
  { kind: 'paste', field: 'providerKey', value: DEMO_CLAUDE_KEY, durationMs: 900, target: 'connect-provider-key', caption: 'Pasting a Claude key' },
  { kind: 'paste', field: 'jevKey', value: DEMO_JEV_KEY, durationMs: 900, target: 'connect-jev-key', caption: "Adding the JEV key (the site's question classifier)" },
  { kind: 'connect', durationMs: 2500, target: 'connect-submit', caption: 'Connecting…' },
  { kind: 'closeConnect', durationMs: 400 },
  { kind: 'ask', question: DEMO_QUESTION, durationMs: 800, target: 'ask-search' },
  { kind: 'answer', answer: DEMO_SCRIPTED_ANSWER, durationMs: 8500, caption: 'The agent answers from the live map' },
  { kind: 'wait', durationMs: 3000 },
  { kind: 'endCard', durationMs: 4000 },
];

export const ALL_DEMO_SCENARIO_ID = 'shopping.place-order';

function groupIntoShots(steps: readonly Step[]): Step[][] {
  const shots: Step[][] = [];
  for (const step of steps) {
    if (step.parallel && shots.length > 0) shots[shots.length - 1].push(step);
    else shots.push([step]);
  }
  return shots;
}

/** How long a scenario or incident takes to play through at speed 1, from its step data. */
export function playbackDurationMs(playableId: string): number {
  const playable = PLAYABLE_BY_ID[playableId];
  if (!playable) throw new Error(`Unknown scenario or incident id "${playableId}" — expected a key of PLAYABLE_BY_ID.`);
  const totalMs = groupIntoShots(stepsForScenario(playable))
    .reduce((sumMs, shot) => sumMs + shotTimelineMs(shot) + SHOT_HANDOFF_MS, 0);
  return Math.ceil(totalMs / 100) * 100;
}

export function scriptedAnswerDurationMs(answer: DemoScriptedAnswer): number {
  return answer.thinkingMs + answer.text.split(' ').length * answer.wordMs;
}

/** §6's AI tour without its settle wait, domain pick, final hold and end card; the answer gets exactly its own length. */
function shortenedAiSegment(): DemoStep[] {
  const skippedStepIndexes = new Set([0, 1, 12, AI_DEMO_SCRIPT.length - 1]);
  return AI_DEMO_SCRIPT
    .filter((_step, stepIndex) => !skippedStepIndexes.has(stepIndex))
    .map((step) => (step.kind === 'answer'
      ? { ...step, durationMs: Math.ceil(scriptedAnswerDurationMs(step.answer) / 100) * 100 }
      : step));
}

export function buildAllDemoScript(): DemoScript {
  const incident = INCIDENTS[0];
  return [
    { kind: 'pressIntro', durationMs: 4000, target: 'intro-start', caption: 'Jumping into Project Cosmos' },
    { kind: 'pickDomain', domainId: 'shopping', durationMs: 2500, target: 'domain-shopping', caption: 'Browsing the map one domain at a time' },
    { kind: 'pickDomain', domainId: 'fulfillment', durationMs: 3000, target: 'domain-fulfillment' },
    { kind: 'pickDomain', domainId: 'shopping', durationMs: 2500, target: 'domain-shopping' },
    { kind: 'playScenario', scenarioId: ALL_DEMO_SCENARIO_ID, durationMs: playbackDurationMs(ALL_DEMO_SCENARIO_ID), caption: 'Playing "Place an order" end to end' },
    { kind: 'stepBack', durationMs: 2500, target: 'playback-step-back', caption: 'Stepping through the flow' },
    { kind: 'stepBack', durationMs: 2500, target: 'playback-step-back' },
    { kind: 'stepForward', durationMs: 2500, target: 'playback-step-forward' },
    { kind: 'stepForward', durationMs: 2500, target: 'playback-step-forward' },
    { kind: 'openIncident', incidentId: incident.id, durationMs: playbackDurationMs(incident.id), caption: 'Replaying a recorded production incident' },
    { kind: 'toggleLegend', isVisible: true, durationMs: 1500, target: 'legend-ownership', caption: 'Who owns what' },
    { kind: 'wait', durationMs: 6000 },
    { kind: 'toggleLegend', isVisible: false, durationMs: 2500, target: 'legend-ownership' },
    ...shortenedAiSegment(),
    { kind: 'endCard', durationMs: 4000 },
  ];
}

export const ALL_DEMO_SCRIPT: DemoScript = buildAllDemoScript();

export const DEMO_SCRIPTS: Record<DemoModeName, DemoScript> = {
  ai: AI_DEMO_SCRIPT,
  all: ALL_DEMO_SCRIPT,
};

export function scriptDurationMs(script: DemoScript): number {
  return script.reduce((totalMs, step) => totalMs + step.durationMs, 0);
}
