import type { AskAction } from '../components/AskPanel';

/** Every fixed `data-demo-target`; scenario and incident menu items add `scenario-<id>` / `incident-<id>`. */
export const DEMO_TARGETS = [
  'intro-start',
  'menu-open',
  'menu-close',
  'galaxy-reset',
  'domain-shopping',
  'domain-fulfillment',
  'domain-engagement',
  'incidents-open',
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

/** Value of a `data-demo-target` attribute the pointer can move to and press. */
export type DemoTarget = (typeof DEMO_TARGETS)[number] | `scenario-${string}` | `incident-${string}`;

export const DEMO_STEP_KINDS = ['click', 'type', 'paste', 'wait'] as const;

export type DemoStepKind = (typeof DEMO_STEP_KINDS)[number];

export interface DemoScriptedAnswer {
  text: string;
  thinkingMs: number;
  wordMs: number;
  actions?: AskAction[];
}

interface DemoStepBase {
  /** The whole step at speed 1, pointer glide and typing included; the rest of it is a pause. */
  durationMs: number;
  caption?: string;
}

/**
 * A viewer gesture on the real UI: `click` presses the target, `type` presses it then types
 * `text` key by key, `paste` presses it then inserts `text` in one paste.
 */
export type DemoStep = DemoStepBase & (
  | { kind: 'click'; target: DemoTarget }
  | { kind: 'type'; target: DemoTarget; text: string }
  | { kind: 'paste'; target: DemoTarget; text: string }
  | { kind: 'wait' }
);

export type DemoScript = readonly DemoStep[];

export type DemoModeName = 'ai' | 'all';

export interface DemoMode {
  mode: DemoModeName;
  speed: number;
}
