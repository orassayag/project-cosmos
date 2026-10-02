import { describe, expect, it, vi } from 'vitest';

const { brokenModule } = vi.hoisted(() => ({
  brokenModule: (): never => {
    throw new Error('agent module failed to load');
  },
}));

vi.mock('../agent/askAnswer.js', brokenModule);
vi.mock('../agent/graph.js', brokenModule);
vi.mock('../agent/classify.js', brokenModule);
vi.mock('../agent/chatModelFactory.js', brokenModule);
vi.mock('@langchain/core/messages', brokenModule);
vi.mock('@langchain/langgraph', brokenModule);
vi.mock('@langchain/anthropic', brokenModule);
vi.mock('@langchain/openai', brokenModule);
vi.mock('ai', brokenModule);

describe('GET /api/cosmos with the AI stack broken', () => {
  it('still serves the map', async () => {
    const { default: app } = await import('../app.js');

    const response = await app.request('/api/cosmos');

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('version');
  });
});
