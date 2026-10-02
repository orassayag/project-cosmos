import { createHash } from 'node:crypto';
import { deepFreeze, getCosmosData } from './index.js';
import { deriveBlastRadius, deriveDependentsOf } from './derive/blastRadius.js';
import { deriveDriftLinks, deriveDriftSearchText, deriveLatestDrift } from './derive/drift.js';
import { deriveConnectedNodeIds, deriveLinks, deriveLogicalEdges } from './derive/graph.js';
import { deriveHealthStatus } from './derive/health.js';
import { deriveOwnership } from './derive/ownership.js';
import { derivePlayable } from './derive/playable.js';
import { deriveTopicGroups } from './derive/topicGroups.js';
import type { CosmosData, CosmosDerived, CosmosView } from './types.js';

let cosmosView: CosmosView | undefined;
let cosmosResponse: CosmosResponseBody | undefined;

export interface CosmosResponseBody {
  version: string;
  /** The serialized `CosmosResponse`, sent as-is by `GET /api/cosmos`. */
  json: string;
}

export function buildCosmosDerived(data: CosmosData): CosmosDerived {
  const connectedNodeIds = deriveConnectedNodeIds(data);
  const dependentsOf = deriveDependentsOf(data);
  const { serviceLinks, topicLinks } = deriveLinks(data);
  return {
    edges: deriveLogicalEdges(data),
    connectedNodeIds,
    serviceLinks,
    topicLinks,
    dependentsOf,
    blastRadius: deriveBlastRadius(data, dependentsOf),
    ownership: deriveOwnership(data),
    topicGroups: deriveTopicGroups(data, connectedNodeIds),
    healthStatus: deriveHealthStatus(data),
    latestDrift: deriveLatestDrift(data.drift.entries),
    driftSearchText: deriveDriftSearchText(data),
    driftLinks: deriveDriftLinks(data),
    playable: derivePlayable(data),
  };
}

export function getCosmosView(): CosmosView {
  if (!cosmosView) {
    const data = getCosmosData();
    cosmosView = deepFreeze({ data, derived: buildCosmosDerived(data) });
  }
  return cosmosView;
}

export function getCosmosResponseBody(): CosmosResponseBody {
  if (!cosmosResponse) {
    const view = getCosmosView();
    const version = createHash('sha256').update(JSON.stringify(view)).digest('hex').slice(0, 16);
    cosmosResponse = { version, json: JSON.stringify({ version, ...view }) };
  }
  return cosmosResponse;
}

export function getCosmosVersion(): string {
  return getCosmosResponseBody().version;
}
