import type { AskAction } from '../components/AskPanel';
import type { AiProvider } from '../hooks/useAiConnection';
import type { Domain } from '../scenarios/types';

export const DEMO_TARGETS = [
  'intro-start',
  'domain-shopping',
  'domain-fulfillment',
  'domain-engagement',
  'ask-input',
  'ask-search',
  'connect-open',
  'connect-provider-anthropic',
  'connect-provider-openai',
  'connect-provider-key',
  'connect-jev-key',
  'connect-submit',
  'playback-play',
  'playback-step-back',
  'playback-step-forward',
  'legend-ownership',
] as const;

/** Value of a `data-demo-target` attribute the fake pointer can glide to. */
export type DemoTarget = (typeof DEMO_TARGETS)[number];

export const DEMO_STEP_KINDS = [
  'pressIntro',
  'pickDomain',
  'type',
  'openConnect',
  'pickProvider',
  'paste',
  'connect',
  'closeConnect',
  'ask',
  'answer',
  'playScenario',
  'stepBack',
  'stepForward',
  'openIncident',
  'toggleLegend',
  'wait',
  'endCard',
] as const;

export type DemoStepKind = (typeof DEMO_STEP_KINDS)[number];

export type DemoConnectField = 'providerKey' | 'jevKey';

/** The fake connection's lifecycle; `connecting` is what renders the Connect window as busy. */
export type DemoAiStatus = 'disconnected' | 'connecting' | 'connected';

export interface DemoScriptedAnswer {
  text: string;
  thinkingMs: number;
  wordMs: number;
  actions?: AskAction[];
}

interface DemoStepBase {
  durationMs: number;
  caption?: string;
  target?: DemoTarget;
}

export type DemoStep = DemoStepBase & (
  | { kind: 'pressIntro' }
  | { kind: 'pickDomain'; domainId: Domain['id'] }
  | { kind: 'type'; text: string }
  | { kind: 'openConnect' }
  | { kind: 'pickProvider'; provider: AiProvider }
  | { kind: 'paste'; field: DemoConnectField; value: string }
  | { kind: 'connect' }
  | { kind: 'closeConnect' }
  | { kind: 'ask'; question: string }
  | { kind: 'answer'; answer: DemoScriptedAnswer }
  | { kind: 'playScenario'; scenarioId: string }
  | { kind: 'stepBack' }
  | { kind: 'stepForward' }
  | { kind: 'openIncident'; incidentId: string }
  | { kind: 'toggleLegend'; isVisible: boolean }
  | { kind: 'wait' }
  | { kind: 'endCard' }
);

export type DemoScript = readonly DemoStep[];

/**
 * Callbacks App supplies to the runner. The runner changes the app only through these —
 * never by dispatching DOM events, which the mouse-down buttons and map pan handler ignore.
 */
export interface DemoActions {
  pressIntro: () => void;
  pickDomain: (domainId: Domain['id']) => void;
  setQuestion: (question: string) => void;
  openConnect: () => void;
  pickProvider: (provider: AiProvider) => void;
  setConnectField: (field: DemoConnectField, value: string) => void;
  setAiStatus: (status: DemoAiStatus) => void;
  closeConnect: () => void;
  setSearchPressed: (isPressed: boolean) => void;
  ask: (question: string) => void;
  playAnswer: (answer: DemoScriptedAnswer) => void;
  playScenario: (scenarioId: string) => void;
  stepBack: () => void;
  stepForward: () => void;
  openIncident: (incidentId: string) => void;
  toggleLegend: (isVisible: boolean) => void;
  showEndCard: () => void;
}

/** Which callbacks each step kind drives; `wait` only sleeps. Lets tests prove every kind is handled. */
export const DEMO_STEP_ACTIONS: Record<DemoStepKind, readonly (keyof DemoActions)[]> = {
  pressIntro: ['pressIntro'],
  pickDomain: ['pickDomain'],
  type: ['setQuestion'],
  openConnect: ['openConnect'],
  pickProvider: ['pickProvider'],
  paste: ['setConnectField'],
  connect: ['setAiStatus'],
  closeConnect: ['closeConnect'],
  ask: ['setSearchPressed', 'ask'],
  answer: ['playAnswer'],
  playScenario: ['playScenario'],
  stepBack: ['stepBack'],
  stepForward: ['stepForward'],
  openIncident: ['openIncident'],
  toggleLegend: ['toggleLegend'],
  wait: [],
  endCard: ['showEndCard'],
};

export type DemoModeName = 'ai' | 'all';

export interface DemoMode {
  mode: DemoModeName;
  speed: number;
}
