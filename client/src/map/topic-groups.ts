import { SERVICES_BY_ID, STEPS, TOPICS } from '../scenarios/data';
import type { Topic } from '../scenarios/types';

/**
 * Topic-to-service attribution: every connected topic joins the group of
 * the service its `groupServiceId` names.
 *
 * Zoomed out, owned topics are invisible — the owner's card shows a count
 * badge. Zoomed in, they fan out on a ring around the service. Collapsing
 * is a position override (members stack on the service center), so edge
 * keys never change and packet animations keep working.
 */
export interface TopicGroup {
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

/**
 * Node ids referenced by at least one step. Topics outside this set have
 * no edges — they'd render as floating orphan dots, so the map skips them.
 */
export const CONNECTED_NODE_IDS: Set<string> = (() => {
  const ids = new Set<string>();
  for (const s of STEPS) {
    ids.add(s.from);
    ids.add(s.to);
    if (s.via) ids.add(s.via);
    if (s.through) ids.add(s.through);
  }
  return ids;
})();

function ownerServiceId(t: Topic): string | null {
  return SERVICES_BY_ID[t.groupServiceId] ? t.groupServiceId : null;
}

/**
 * Expanded members sit on a ring around the owning service, speed-dial
 * style, starting at 12 o'clock. `above` = hemisphere, for label flipping.
 */
export function radialMemberPosition(
  g: TopicGroup,
  idx: number,
): { x: number; y: number; above: boolean } {
  const n = g.members.length;
  const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
  const sin = Math.sin(angle);
  return {
    x: Math.round(g.cx + Math.cos(angle) * g.ringRadius),
    y: Math.round(g.cy + sin * g.ringRadius),
    above: sin < 0,
  };
}

export const TOPIC_GROUPS: TopicGroup[] = (() => {
  const byOwner = new Map<string, Topic[]>();
  for (const t of TOPICS) {
    if (!CONNECTED_NODE_IDS.has(t.id)) continue;
    const owner = ownerServiceId(t);
    if (!owner) continue;
    const list = byOwner.get(owner) ?? [];
    list.push(t);
    byOwner.set(owner, list);
  }
  const groups: TopicGroup[] = [];
  for (const [serviceId, members] of byOwner) {
    const svc = SERVICES_BY_ID[serviceId];
    groups.push({
      id: `group-${serviceId}`,
      serviceId,
      members,
      memberIds: new Set(members.map((m) => m.id)),
      cx: svc.x,
      cy: svc.y,
      // Must clear the capsule (~115 half-width) even for a single topic.
      ringRadius: Math.max(150, members.length * 15),
    });
  }
  return groups;
})();
