/** Null means classification must use the free local fallback. */
export function getGatewayApiKey(): string | null {
  return process.env.AI_GATEWAY_API_KEY?.trim() || null;
}
