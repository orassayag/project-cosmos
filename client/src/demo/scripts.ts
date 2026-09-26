import { DEMO_QUESTION, DEMO_SCRIPTED_ANSWER } from './scriptedAnswer';
import type { DemoModeName, DemoScript } from './types';

/** Obviously fake keys: the demo only shows them being pasted, nothing is ever sent. */
const DEMO_CLAUDE_KEY = 'sk-ant-demo-astromart-0000';
const DEMO_JEV_KEY = 'jev-demo-astromart-0000';

export const DEMO_TIME_LIMITS_MS: Partial<Record<DemoModeName, number>> = {
  ai: 60_000,
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

export const DEMO_SCRIPTS: Partial<Record<DemoModeName, DemoScript>> = {
  ai: AI_DEMO_SCRIPT,
};

export function scriptDurationMs(script: DemoScript): number {
  return script.reduce((totalMs, step) => totalMs + step.durationMs, 0);
}
