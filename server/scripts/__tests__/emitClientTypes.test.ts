import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emitClientTypes, GENERATED_HEADER } from '../emit-client-types.js';

const API_TYPES_PATH = new URL('../../src/cosmos/apiTypes.ts', import.meta.url);
const CLIENT_COPY_PATH = new URL('../../../client/src/api/cosmos-api.ts', import.meta.url);

describe('emitClientTypes', () => {
  it('returns the header followed by the source, byte for byte', () => {
    const source = 'export interface Example {\n  id: string;\n}\n';

    expect(emitClientTypes(source)).toBe(GENERATED_HEADER + source);
  });

  it.each([
    "import type { Example } from './example.js';",
    "  import './side-effect.js';",
    "export type { Example } from './example.js';",
    "export * from './example.js';",
  ])('rejects a source that pulls in another module: %s', (dependencyLine) => {
    const source = `export interface Example {\n  id: string;\n}\n${dependencyLine}\n`;

    expect(() => emitClientTypes(source)).toThrow(/line 4/);
  });

  it('accepts a comment that mentions imports', () => {
    expect(() => emitClientTypes('// Must stay self-contained (no imports).\n')).not.toThrow();
  });

  it('matches the committed client copy', () => {
    const emitted = emitClientTypes(readFileSync(API_TYPES_PATH, 'utf8'));

    expect(readFileSync(CLIENT_COPY_PATH, 'utf8')).toBe(emitted);
  });
});
