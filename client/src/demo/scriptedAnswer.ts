import type { DemoAiTour } from '../api/cosmos-api';
import type { DemoLayout } from './scripts';
import type { DemoScriptedAnswer } from './types';

/**
 * The `?demo=ai` answer: highlight the services it names, and on desktop open the first one's
 * passport beside the answer. On a phone the passport would cover the answer, so it is left out.
 */
export function buildDemoScriptedAnswer(aiTour: DemoAiTour, { isPhone }: DemoLayout): DemoScriptedAnswer {
  return {
    ...aiTour.scriptedAnswer,
    actions: [
      { type: 'action', kind: 'highlight', serviceIds: aiTour.highlightServiceIds },
      ...(isPhone ? [] : [{ type: 'action', kind: 'openPassport', nodeId: aiTour.passportNodeId } as const]),
    ],
  };
}
