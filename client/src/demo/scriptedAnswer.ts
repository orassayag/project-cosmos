import type { DemoAiTour, DemoAiTurn, DemoAnswerScript } from '../api/cosmos-api';
import type { DemoLayout } from './scripts';

/**
 * The `?demo=ai` chat turns for this layout. On a phone the chat is a bottom sheet, and any
 * surface an action opens (passport, legend, changelog, scenario) would cover the answer while it
 * plays, so only the highlights are kept there.
 */
export function buildDemoScriptedTurns(aiTour: DemoAiTour, { isPhone }: DemoLayout): DemoAiTurn[] {
  if (!isPhone) return aiTour.turns;
  return aiTour.turns.map((turn) => ({ ...turn, actions: turn.actions.filter((action) => action.kind === 'highlight') }));
}

/** How long a scripted answer takes to play: the thinking pause, then one word per `wordMs`. */
export function scriptedAnswerDurationMs({ text, thinkingMs, wordMs }: DemoAnswerScript): number {
  return thinkingMs + scriptedAnswerWords(text).length * wordMs;
}

export function scriptedAnswerWords(text: string): string[] {
  return text.split(' ');
}
