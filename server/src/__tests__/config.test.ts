import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getGatewayApiKey } from '../config.js';

describe('app without AI configuration', () => {
  let consoleLines: Mock;

  beforeEach(() => {
    for (const name of ['VERCEL', 'COSMOS_LOCAL_AGENT', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_GATEWAY_API_KEY']) {
      vi.stubEnv(name, undefined);
    }
    consoleLines = vi.fn();
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation(consoleLines);
    }
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('imports and serves the map without any AI env, logging nothing at import', async () => {
    const app = (await import('../app.js')).default;

    const response = await app.request('/api/cosmos');

    expect(response.status).toBe(200);
    expect(consoleLines).not.toHaveBeenCalled();
  });
});

describe('getGatewayApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the trimmed key', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '  gateway-test-key ');

    expect(getGatewayApiKey()).toBe('gateway-test-key');
  });

  it.each([undefined, '', '   '])('returns null for %o', (value) => {
    vi.stubEnv('AI_GATEWAY_API_KEY', value);

    expect(getGatewayApiKey()).toBeNull();
  });
});
