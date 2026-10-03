import type { AgentHints } from './route.js';

export const SYSTEM_PROMPT_INSTRUCTIONS =
  'You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below and your read tools. ' +
  'The data is a snapshot: its "As of" date is today, so measure relative times ("past 24 hours", "this week") from it, never from the real clock. ' +
  'The drift (changelog) and health data are AstroMart demo data; still answer from them as the current state of the system. ' +
  'For details the digest leaves out, call the read tools: `get_service`, `get_steps` (payloads), `blast_radius`, `who_owns`, `on_call`, `drift` (changelog). ' +
  'When you mention specific services, call `highlight_services`. ' +
  'When the visitor would benefit from seeing a flow, call `play_scenario`. ' +
  'To show an answer on the map, call `show_blast_radius`, `open_passport`, `show_health`, `show_ownership` or `open_changelog_entry`. ' +
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
