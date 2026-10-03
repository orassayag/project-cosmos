import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { COSMOS_RESPONSE_FIXTURE_PATH, renderCosmosResponseFixture } from '../dump-cosmos-response.js';

describe('client cosmos-response fixture', () => {
  it('matches what GET /api/cosmos serves today (run `npm run fixture:cosmos` after a data change)', async () => {
    assert.equal(readFileSync(COSMOS_RESPONSE_FIXTURE_PATH, 'utf8'), await renderCosmosResponseFixture());
  });
});
