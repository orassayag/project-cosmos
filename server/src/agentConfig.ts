import { getGatewayApiKey } from './config.js';
import { createLogger, type AiProvider } from './logger.js';

export const AI_NOT_LOCAL = 'AI_NOT_LOCAL';
export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED';

export type AgentUnavailableReason = typeof AI_NOT_LOCAL | typeof AI_NOT_CONFIGURED;

export interface AgentConfig {
  provider: AiProvider;
  apiKey: string;
  gatewayApiKey: string | null;
}

export type AgentConfigResult = { ok: true; config: AgentConfig } | { ok: false; reason: AgentUnavailableReason };

const logger = createLogger('agent-config');
const reportedCodes = new Set<string>();

function logOnce(errorCode: string, message: string): void {
  if (reportedCodes.has(errorCode)) {
    return;
  }
  reportedCodes.add(errorCode);
  logger.info(message, { errorCode });
}

function readKey(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/**
 * Read on every call, never at import, so the map boots without any AI env.
 * `COSMOS_LOCAL_AGENT` is only ever set by the local dev server (after it loads env files),
 * so no deployed host can enable the agent through configuration; `VERCEL` is the backup check.
 */
export function getAgentConfig(): AgentConfigResult {
  if (process.env.VERCEL || process.env.COSMOS_LOCAL_AGENT !== '1') {
    logOnce('AI_DISABLED_NOT_LOCAL', 'The agent only runs on the local dev server; AI routes are disabled');
    return { ok: false, reason: AI_NOT_LOCAL };
  }
  const anthropicApiKey = readKey('ANTHROPIC_API_KEY');
  const openaiApiKey = readKey('OPENAI_API_KEY');
  const gatewayApiKey = getGatewayApiKey();
  if (anthropicApiKey) {
    if (openaiApiKey) {
      logOnce('AI_PROVIDER_BOTH_SET', 'Both ANTHROPIC_API_KEY and OPENAI_API_KEY are set; using Anthropic');
    }
    return { ok: true, config: { provider: 'anthropic', apiKey: anthropicApiKey, gatewayApiKey } };
  }
  if (openaiApiKey) {
    return { ok: true, config: { provider: 'openai', apiKey: openaiApiKey, gatewayApiKey } };
  }
  return { ok: false, reason: AI_NOT_CONFIGURED };
}
