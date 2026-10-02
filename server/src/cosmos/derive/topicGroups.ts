import type { CosmosData, TopicGroup } from '../types.js';

/**
 * Every connected topic joins the group of the service its `groupServiceId` names, in topic declaration order.
 * Groups appear in the order their first member does. Ring geometry stays client-side.
 */
export function deriveTopicGroups(data: CosmosData, connectedNodeIds: readonly string[]): TopicGroup[] {
  const connected = new Set(connectedNodeIds);
  const serviceIds = new Set(data.services.map((service) => service.id));
  const memberIdsByService = new Map<string, string[]>();
  for (const topic of data.topics) {
    if (!connected.has(topic.id) || !serviceIds.has(topic.groupServiceId)) continue;
    const memberIds = memberIdsByService.get(topic.groupServiceId) ?? [];
    memberIds.push(topic.id);
    memberIdsByService.set(topic.groupServiceId, memberIds);
  }
  return [...memberIdsByService].map(([serviceId, memberIds]) => ({ id: `group-${serviceId}`, serviceId, memberIds }));
}
