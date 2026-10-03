import type { CosmosData } from '../api/cosmos-api';
import type { AskAction } from './askStream';

export const MAX_FOLLOW_UPS = 3;

export interface FollowUpSource {
  content: string;
  actions: readonly AskAction[];
}

export type FollowUpSnapshot = Pick<CosmosData, 'services' | 'scenarios'>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstMentionIndex(content: string, terms: readonly string[]): number {
  let firstIndex = -1;
  for (const term of terms) {
    if (term.trim() === '') continue;
    const match = new RegExp(`(^|[^\\w-])${escapeRegExp(term)}(?![\\w-])`, 'i').exec(content);
    if (match && (firstIndex === -1 || match.index < firstIndex)) firstIndex = match.index;
  }
  return firstIndex;
}

/** Ids the answer acted on come first, then ids its text mentions, in reading order. */
function orderedIds(actionIds: readonly string[], mentions: ReadonlyArray<{ id: string; index: number }>): string[] {
  const ids = [...actionIds];
  for (const { id } of [...mentions].sort((first, second) => first.index - second.index)) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Follow-up questions built from the last answer alone — no extra model call. */
export function suggestFollowUps(lastAnswer: FollowUpSource, snapshot: FollowUpSnapshot): string[] {
  const servicesById = new Map(snapshot.services.map((service) => [service.id, service]));
  const playableScenarios = snapshot.scenarios.filter((scenario) => scenario.status === 'ready');
  const scenariosById = new Map(playableScenarios.map((scenario) => [scenario.id, scenario]));

  const actedServiceIds: string[] = [];
  const actedScenarioIds: string[] = [];
  for (const action of lastAnswer.actions) {
    if (action.kind === 'highlight') actedServiceIds.push(...action.serviceIds);
    else if (action.kind === 'showBlastRadius' || action.kind === 'openPassport') actedServiceIds.push(action.nodeId);
    else if (action.kind === 'playScenario') actedScenarioIds.push(action.scenarioId);
  }

  const serviceMentions = snapshot.services
    .map((service) => ({ id: service.id, index: firstMentionIndex(lastAnswer.content, [service.id, service.name]) }))
    .filter((mention) => mention.index !== -1);
  const scenarioMentions = playableScenarios
    .map((scenario) => ({ id: scenario.id, index: firstMentionIndex(lastAnswer.content, [scenario.id]) }))
    .filter((mention) => mention.index !== -1);

  const service = orderedIds(actedServiceIds, serviceMentions)
    .map((id) => servicesById.get(id))
    .find((candidate) => candidate !== undefined);
  const scenario = orderedIds(actedScenarioIds, scenarioMentions)
    .map((id) => scenariosById.get(id))
    .find((candidate) => candidate !== undefined);

  const followUps: string[] = [];
  if (service) followUps.push(`Who owns ${service.name}?`, `What breaks if ${service.name} fails?`);
  if (scenario) followUps.push(`Play ${scenario.label}`);
  return followUps.slice(0, MAX_FOLLOW_UPS);
}
