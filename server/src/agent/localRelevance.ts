import type { CosmosMapSnapshot } from './types/cosmosMapSnapshot.js';

const ARCHITECTURE_WORDS = [
  'architecture',
  'astromart',
  'service',
  'services',
  'microservice',
  'microservices',
  'topic',
  'topics',
  'kafka',
  'api',
  'endpoint',
  'queue',
  'event',
  'events',
  'flow',
  'scenario',
  'incident',
  'outage',
  'owner',
  'owns',
];

const MIN_TERM_LENGTH = 3;

// Folds case and every separator to single spaces, so "Payments-Gateway", "orders.created"
// and "api gateway" compare equal to their snapshot ids.
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function collectTerms(snapshot: CosmosMapSnapshot): string[] {
  const rawTerms = [
    ...snapshot.services.flatMap((service) => [service.id, service.name]),
    ...snapshot.topics.flatMap((topic) => [topic.id, topic.name]),
    ...snapshot.domains.flatMap((domain) => [domain.id, domain.label]),
    ...snapshot.teams.flatMap((team) => [team.id, team.label]),
    ...snapshot.scenarios.flatMap((scenario) => [scenario.id, scenario.title]),
    ...snapshot.incidents.flatMap((incident) => [incident.id, incident.title]),
    ...ARCHITECTURE_WORDS,
  ];
  const terms = rawTerms.map(normalize).filter((term) => term.length >= MIN_TERM_LENGTH);
  return [...new Set(terms)];
}

const termCache = new WeakMap<CosmosMapSnapshot, string[]>();

/** Free keyword check used when the classifier is unavailable: on-topic when any map name or architecture word appears as whole words. */
export function localRelevance(question: string, snapshot: CosmosMapSnapshot): boolean {
  let terms = termCache.get(snapshot);
  if (!terms) {
    terms = collectTerms(snapshot);
    termCache.set(snapshot, terms);
  }
  const paddedQuestion = ` ${normalize(question)} `;
  return terms.some((term) => paddedQuestion.includes(` ${term} `));
}
