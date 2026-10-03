import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../server/src/app.js';

/**
 * Writes the client test fixture from the real `GET /api/cosmos` route — never edit it by hand.
 * `scripts/__tests__/cosmosResponseFixture.test.ts` fails when the committed copy is stale.
 *
 *   pnpm fixture:cosmos
 */
export const COSMOS_RESPONSE_FIXTURE_PATH = resolve(
  import.meta.dirname,
  '../client/src/__tests__/fixtures/cosmos-response.json',
);

export async function renderCosmosResponseFixture(): Promise<string> {
  const response = await app.request('/api/cosmos');
  if (!response.ok) throw new Error(`GET /api/cosmos answered ${response.status}; expected 200`);
  return `${JSON.stringify(await response.json(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(COSMOS_RESPONSE_FIXTURE_PATH, await renderCosmosResponseFixture());
  console.log(`wrote ${COSMOS_RESPONSE_FIXTURE_PATH}`);
}
