import type { AgentHints } from './route.js';

export const SYSTEM_PROMPT_INSTRUCTIONS =
  'You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below. ' +
  'When you mention specific services, call `highlight_services`. ' +
  'When the visitor would benefit from seeing a flow, call `play_scenario`. ' +
  "If the data doesn't cover the question, say so plainly. Keep answers under ~150 words.";

function formatHints(hints: AgentHints): string {
  return [
    '## Routing hints (from a lightweight classifier; may be wrong)',
    `- likely intent: ${hints.intent ?? 'unknown'}`,
    `- likely scenario: ${hints.targetScenarioId ?? 'none'}`,
  ].join('\n');
}

export interface SystemPromptInput {
  digest: string;
  hints: AgentHints;
}

export function buildSystemPrompt({ digest, hints }: SystemPromptInput): string {
  return [SYSTEM_PROMPT_INSTRUCTIONS, '# Map data', digest, formatHints(hints)].join('\n\n');
}
