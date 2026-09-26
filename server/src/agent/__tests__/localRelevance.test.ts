import { describe, expect, it } from 'vitest';
import cosmosMap from '../../generated/cosmos-map.json' with { type: 'json' };
import { localRelevance } from '../localRelevance.js';

describe('localRelevance', () => {
  it.each([
    "what's the weather",
    'tell me a joke',
    'who won the football game last night?',
    'recommend a cartoon to watch',
    'how do I bake bread',
  ])('treats %j as off-topic', (question) => {
    expect(localRelevance(question, cosmosMap)).toBe(false);
  });

  it.each([
    'what does payments-gateway do',
    'What does the API Gateway do?',
    'who publishes orders.created',
    'which team owns inventory',
    'show me the Pack & Ship flow',
    'what happened in the Payment cascade',
    'explain the architecture',
  ])('treats %j as on-topic', (question) => {
    expect(localRelevance(question, cosmosMap)).toBe(true);
  });
});
