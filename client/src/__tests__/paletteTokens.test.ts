/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import cosmosResponseFixture from './fixtures/cosmos-response.json';

// Read from disk: vitest stubs CSS imports (even ?raw) to an empty string.
const tokensCss = readFileSync(resolve(import.meta.dirname, '../styles/tokens.css'), 'utf8');
const paletteKeys = Object.keys(cosmosResponseFixture.data.palette);

describe('service palette tokens', () => {
  it('the served palette is not empty', () => {
    expect(paletteKeys.length).toBeGreaterThan(0);
  });

  it.each(paletteKeys)('palette key "%s" has a --svc token in tokens.css', (key) => {
    expect(tokensCss).toMatch(new RegExp(`--svc-${key}:`));
  });
});
