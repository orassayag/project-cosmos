import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

type AgentConfigModule = typeof import('../agentConfig.js');

describe('getAgentConfig', () => {
  let agentConfigModule: AgentConfigModule;
  let consoleLog: Mock;

  function infoCodes(): unknown[] {
    return consoleLog.mock.calls.map(([line]) => (JSON.parse(String(line)) as { errorCode: string }).errorCode);
  }

  beforeEach(async () => {
    vi.stubEnv('VERCEL', undefined);
    vi.stubEnv('COSMOS_LOCAL_AGENT', '1');
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('OPENAI_API_KEY', undefined);
    vi.stubEnv('AI_GATEWAY_API_KEY', undefined);
    consoleLog = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(consoleLog);
    // A fresh module graph resets the log-once flags between cases.
    vi.resetModules();
    agentConfigModule = await import('../agentConfig.js');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is not local on Vercel even with keys and the local flag set', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    expect(agentConfigModule.getAgentConfig()).toEqual({ ok: false, reason: 'AI_NOT_LOCAL' });
  });

  it('is not local when the flag is missing', () => {
    vi.stubEnv('COSMOS_LOCAL_AGENT', undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    expect(agentConfigModule.getAgentConfig()).toEqual({ ok: false, reason: 'AI_NOT_LOCAL' });
  });

  it('logs the not-local reason once at INFO', () => {
    vi.stubEnv('COSMOS_LOCAL_AGENT', undefined);

    agentConfigModule.getAgentConfig();
    agentConfigModule.getAgentConfig();

    expect(infoCodes()).toEqual(['AI_DISABLED_NOT_LOCAL']);
  });

  it('is not configured when local with no provider key', () => {
    expect(agentConfigModule.getAgentConfig()).toEqual({ ok: false, reason: 'AI_NOT_CONFIGURED' });
  });

  it('treats whitespace-only keys as missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '   ');
    vi.stubEnv('OPENAI_API_KEY', '\t\n');

    expect(agentConfigModule.getAgentConfig()).toEqual({ ok: false, reason: 'AI_NOT_CONFIGURED' });
  });

  it('uses OpenAI when only its key is set', () => {
    vi.stubEnv('OPENAI_API_KEY', ' sk-openai-test ');

    expect(agentConfigModule.getAgentConfig()).toEqual({
      ok: true,
      config: { provider: 'openai', apiKey: 'sk-openai-test', gatewayApiKey: null },
    });
  });

  it('prefers Anthropic when both keys are set and logs it once', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test');
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-test-key');

    const first = agentConfigModule.getAgentConfig();
    agentConfigModule.getAgentConfig();

    expect(first).toEqual({
      ok: true,
      config: { provider: 'anthropic', apiKey: 'sk-ant-test', gatewayApiKey: 'gateway-test-key' },
    });
    expect(infoCodes()).toEqual(['AI_PROVIDER_BOTH_SET']);
    expect(JSON.stringify(consoleLog.mock.calls)).not.toContain('sk-ant-test');
  });

  it('reads the env on every call', () => {
    expect(agentConfigModule.getAgentConfig().ok).toBe(false);

    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

    expect(agentConfigModule.getAgentConfig().ok).toBe(true);
  });
});
