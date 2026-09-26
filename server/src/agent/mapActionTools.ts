import { tool, type ToolRunnableConfig } from '@langchain/core/tools';
import { getWriter } from '@langchain/langgraph';
import { z } from 'zod';
import type { CosmosMapSnapshot } from './types/cosmosMapSnapshot.js';

export const HIGHLIGHT_SERVICES_TOOL_NAME = 'highlight_services';
export const PLAY_SCENARIO_TOOL_NAME = 'play_scenario';

export type MapActionEvent =
  | { type: 'action'; kind: 'highlight'; serviceIds: string[] }
  | { type: 'action'; kind: 'playScenario'; scenarioId: string };

const HighlightServicesInputSchema = z.object({
  serviceIds: z.array(z.string()).describe('Service ids exactly as listed under "Services" in the map data.'),
});

const PlayScenarioInputSchema = z.object({
  scenarioId: z.string().describe('A scenario or incident id exactly as listed in the map data.'),
});

// z.enum needs a non-empty tuple; an empty map simply accepts nothing.
function knownIdSchema(ids: readonly string[]) {
  const [firstId, ...otherIds] = ids;
  return firstId === undefined ? z.never() : z.enum([firstId, ...otherIds]);
}

function emitMapAction(config: ToolRunnableConfig, event: MapActionEvent): void {
  getWriter(config)?.(event);
}

export function isMapActionEvent(value: unknown): value is MapActionEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return event.type === 'action' && (event.kind === 'highlight' || event.kind === 'playScenario');
}

/** The two tools the agent may call; each drops ids the snapshot doesn't know and only emits an action for known ones. */
export function createMapActionTools(snapshot: CosmosMapSnapshot) {
  const KnownServiceIdSchema = knownIdSchema(snapshot.services.map((service) => service.id));
  // Incidents are playable too, matching decideRoute's direct-action targets.
  const KnownPlayableIdSchema = knownIdSchema(
    [...snapshot.scenarios, ...snapshot.incidents].map((playable) => playable.id),
  );

  const highlightServices = tool(
    ({ serviceIds }, config) => {
      const knownServiceIds = [...new Set(serviceIds)].filter(
        (serviceId) => KnownServiceIdSchema.safeParse(serviceId).success,
      );
      const droppedServiceIds = serviceIds.filter((serviceId) => !knownServiceIds.includes(serviceId));
      const droppedNote =
        droppedServiceIds.length > 0 ? ` Not on the map, ignored: ${droppedServiceIds.join(', ')}.` : '';
      if (knownServiceIds.length === 0) {
        return `Nothing highlighted.${droppedNote}`;
      }
      emitMapAction(config, { type: 'action', kind: 'highlight', serviceIds: knownServiceIds });
      return `Highlighted ${knownServiceIds.join(', ')} on the map.${droppedNote}`;
    },
    {
      name: HIGHLIGHT_SERVICES_TOOL_NAME,
      description: 'Highlight services on the map for the visitor. Call it whenever the answer names specific services.',
      schema: HighlightServicesInputSchema,
    },
  );

  const playScenario = tool(
    ({ scenarioId }, config) => {
      if (!KnownPlayableIdSchema.safeParse(scenarioId).success) {
        return `No scenario "${scenarioId}" exists on the map; nothing was played.`;
      }
      emitMapAction(config, { type: 'action', kind: 'playScenario', scenarioId });
      return `Started playing ${scenarioId} on the map.`;
    },
    {
      name: PLAY_SCENARIO_TOOL_NAME,
      description: 'Play a scenario or incident flow on the map when seeing it would help the visitor.',
      schema: PlayScenarioInputSchema,
    },
  );

  return [highlightServices, playScenario];
}
