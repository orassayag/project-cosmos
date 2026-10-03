import type { Service, Topic, TopicGroup } from '../api/cosmos-api';

/**
 * Ring geometry for the server's topic groups. Zoomed out, a group's topics
 * collapse into a count badge on the owning service; zoomed in, they fan out
 * on a ring around it. Collapsing is a position override, so edge keys never
 * change and packet animations keep working.
 */
export interface TopicGroupLayout {
  /** No dots/colons — used inside url(#…) gradient references. */
  id: string;
  serviceId: string;
  members: Topic[];
  memberIds: Set<string>;
  /** Ring center = the owning service's center. */
  cx: number;
  cy: number;
  /** Ring radius — clears the owner's capsule body. */
  ringRadius: number;
}

export function layoutTopicGroups(
  groups: readonly TopicGroup[],
  servicesById: Record<string, Service>,
  topicsById: Record<string, Topic>,
): TopicGroupLayout[] {
  return groups.flatMap((group) => {
    const service = servicesById[group.serviceId];
    const members = group.memberIds.map((id) => topicsById[id]).filter(Boolean);
    if (!service || members.length === 0) return [];
    return [
      {
        id: group.id,
        serviceId: group.serviceId,
        members,
        memberIds: new Set(group.memberIds),
        cx: service.x,
        cy: service.y,
        // Must clear the capsule (~115 half-width) even for a single topic.
        ringRadius: Math.max(150, members.length * 15),
      },
    ];
  });
}

/** Expanded members sit on a ring starting at 12 o'clock; `above` = hemisphere, for label flipping. */
export function radialMemberPosition(
  group: TopicGroupLayout,
  idx: number,
): { x: number; y: number; above: boolean } {
  const angle = (idx / group.members.length) * Math.PI * 2 - Math.PI / 2;
  const sin = Math.sin(angle);
  return {
    x: Math.round(group.cx + Math.cos(angle) * group.ringRadius),
    y: Math.round(group.cy + sin * group.ringRadius),
    above: sin < 0,
  };
}
