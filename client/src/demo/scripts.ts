import type { CosmosResponse, Step } from '../api/cosmos-api';
import { indexCosmos, stepsFor } from '../api/cosmosIndex';
import { shotTimelineMs } from '../map/CometPackets';
import { buildDemoScriptedAnswer } from './scriptedAnswer';
import { typingDurationMs } from './humanMotion';
import { POINTER_MOVE_MS } from './runDemo';
import type { DemoModeName, DemoScript, DemoScriptedAnswer, DemoStep } from './types';

/** Obviously fake keys: the demo pastes them for real, but the demo connection never sends them. */
const DEMO_CLAUDE_KEY = 'sk-ant-demo-astromart-0000';
const DEMO_JEV_KEY = 'jev-demo-astromart-0000';

/** Allowance for the React commits between one shot's timeline ending and the next one starting. */
const SHOT_HANDOFF_MS = 100;

export const DEMO_TIME_LIMITS_MS: Record<DemoModeName, number> = {
  ai: 60_000,
  all: 120_000,
};

/** Layout the script is built for: on a phone the domain and incident pickers live in the drawer. */
export interface DemoLayout {
  isPhone: boolean;
}

function groupIntoShots(steps: readonly Step[]): Step[][] {
  const shots: Step[][] = [];
  for (const step of steps) {
    if (step.parallel && shots.length > 0) shots[shots.length - 1].push(step);
    else shots.push([step]);
  }
  return shots;
}

/** How long a scenario or incident takes to play through at speed 1, from its step data. */
export function playbackDurationMs(response: CosmosResponse, playableId: string): number {
  if (!indexCosmos(response).playableById[playableId]) {
    throw new Error(`Unknown scenario or incident id "${playableId}" — expected a scenario or incident in the cosmos data.`);
  }
  const totalMs = groupIntoShots(stepsFor(response, playableId))
    .reduce((sumMs, shot) => sumMs + shotTimelineMs(shot) + SHOT_HANDOFF_MS, 0);
  return Math.ceil(totalMs / 100) * 100;
}

export function scriptedAnswerDurationMs(answer: DemoScriptedAnswer): number {
  return answer.thinkingMs + answer.text.split(' ').length * answer.wordMs;
}

/** Play is pressed only after the pointer's glide, so the step covers both. */
function pressAndPlayMs(response: CosmosResponse, playableId: string): number {
  return POINTER_MOVE_MS + playbackDurationMs(response, playableId);
}

function openDrawer({ isPhone }: DemoLayout): DemoStep[] {
  return isPhone ? [{ kind: 'click', target: 'menu-open', durationMs: 900 }] : [];
}

function closeDrawer({ isPhone }: DemoLayout): DemoStep[] {
  return isPhone ? [{ kind: 'click', target: 'menu-close', durationMs: 900 }] : [];
}

/** Opens Connect from the Ask box, pastes the fake keys, connects, then types the question and searches. */
function connectAndAskSteps(response: CosmosResponse, layout: DemoLayout): DemoStep[] {
  const { aiTour } = response.data.demo;
  const answerMs = Math.ceil(scriptedAnswerDurationMs(buildDemoScriptedAnswer(aiTour, layout)) / 100) * 100;
  return [
    { kind: 'click', target: 'ask-input', durationMs: 1000, caption: 'Connecting an AI agent' },
    { kind: 'click', target: 'connect-open', durationMs: 1100 },
    { kind: 'click', target: 'connect-provider-anthropic', durationMs: 800 },
    { kind: 'paste', target: 'connect-provider-key', text: DEMO_CLAUDE_KEY, durationMs: 1100, caption: 'Pasting a Claude key' },
    { kind: 'paste', target: 'connect-jev-key', text: DEMO_JEV_KEY, durationMs: 1100, caption: 'Adding an optional Vercel AI Gateway key for the question classifier' },
    { kind: 'click', target: 'connect-submit', durationMs: 2800, caption: 'Connecting…' },
    { kind: 'click', target: 'ask-input', durationMs: 900, caption: 'Asking the map a question' },
    { kind: 'type', target: 'ask-input', text: aiTour.question, durationMs: POINTER_MOVE_MS + typingDurationMs(aiTour.question) + 300 },
    { kind: 'click', target: 'ask-search', durationMs: 800 },
    { kind: 'wait', durationMs: answerMs, caption: 'The agent answers from the live map' },
  ];
}

function domainLabel(response: CosmosResponse, domainId: string): string {
  return response.data.domains.find((domain) => domain.id === domainId)?.label ?? domainId;
}

export function buildAiDemoScript(response: CosmosResponse, layout: DemoLayout): DemoScript {
  const { domainId } = response.data.demo.aiTour;
  return [
    { kind: 'wait', durationMs: 800 },
    ...openDrawer(layout),
    { kind: 'click', target: `domain-${domainId}`, durationMs: 1400, caption: `Exploring the ${domainLabel(response, domainId)} domain` },
    ...closeDrawer(layout),
    ...connectAndAskSteps(response, layout),
    { kind: 'wait', durationMs: 3000 },
  ];
}

function replayIncidentSteps(response: CosmosResponse, incidentId: string, layout: DemoLayout): DemoStep[] {
  return [
    ...openDrawer(layout),
    { kind: 'click', target: 'incidents-open', durationMs: 1200, caption: 'Replaying a recorded production incident' },
    { kind: 'click', target: `incident-${incidentId}`, durationMs: 1200 },
    { kind: 'click', target: 'playback-play', durationMs: pressAndPlayMs(response, incidentId) },
  ];
}

export function buildAllDemoScript(response: CosmosResponse, layout: DemoLayout): DemoScript {
  const { scenarioId, incidentId, browseDomainId } = response.data.demo.allTour;
  const scenario = indexCosmos(response).scenariosById[scenarioId];
  if (!scenario) throw new Error(`demo.allTour.scenarioId "${scenarioId}" is not a scenario in the cosmos data.`);
  return [
    { kind: 'click', target: 'intro-start', durationMs: 4000, caption: 'Jumping into Project Cosmos' },
    ...openDrawer(layout),
    { kind: 'click', target: `domain-${scenario.domain}`, durationMs: 2200, caption: 'Browsing the map one domain at a time' },
    { kind: 'click', target: `domain-${browseDomainId}`, durationMs: 2500 },
    { kind: 'click', target: `domain-${scenario.domain}`, durationMs: 1800 },
    { kind: 'click', target: `scenario-${scenarioId}`, durationMs: 1300, caption: `Picking "${scenario.label}"` },
    { kind: 'click', target: 'playback-play', durationMs: pressAndPlayMs(response, scenarioId), caption: 'Playing it end to end' },
    { kind: 'click', target: 'playback-step-back', durationMs: 2000, caption: 'Stepping through the flow' },
    { kind: 'click', target: 'playback-step-back', durationMs: 2000 },
    { kind: 'click', target: 'playback-step-forward', durationMs: 2000 },
    { kind: 'click', target: 'playback-step-forward', durationMs: 2000 },
    ...(incidentId === null ? [] : replayIncidentSteps(response, incidentId, layout)),
    { kind: 'click', target: 'galaxy-reset', durationMs: 1200, caption: 'Back to the whole galaxy' },
    { kind: 'click', target: 'legend-ownership', durationMs: 5500, caption: 'Who owns what' },
    { kind: 'click', target: 'legend-ownership', durationMs: 1500 },
    ...connectAndAskSteps(response, layout),
    { kind: 'wait', durationMs: 2000 },
  ];
}

export function buildDemoScript(response: CosmosResponse, mode: DemoModeName, layout: DemoLayout): DemoScript {
  return mode === 'ai' ? buildAiDemoScript(response, layout) : buildAllDemoScript(response, layout);
}

export function scriptDurationMs(script: DemoScript): number {
  return script.reduce((totalMs, step) => totalMs + step.durationMs, 0);
}
