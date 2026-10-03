import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_HEADER =
  '// GENERATED from server/src/cosmos/apiTypes.ts by pnpm types:emit — do not edit.\n';

const SOURCE_PATH = fileURLToPath(new URL('../src/cosmos/apiTypes.ts', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('../../client/src/api/cosmos-api.ts', import.meta.url));

const DEPENDENCY_LINE = /^\s*(import\b|export\b.*\bfrom\s*['"])/;

export function emitClientTypes(source: string): string {
  const lines = source.split('\n');
  const offendingIndex = lines.findIndex((line) => DEPENDENCY_LINE.test(line));
  if (offendingIndex !== -1) {
    throw new Error(
      `apiTypes.ts must be self-contained, but line ${offendingIndex + 1} pulls in another module: ${JSON.stringify(lines[offendingIndex].trim())}`,
    );
  }
  return GENERATED_HEADER + source;
}

function main(): void {
  writeFileSync(OUTPUT_PATH, emitClientTypes(readFileSync(SOURCE_PATH, 'utf8')));
  console.log(`types:emit wrote ${OUTPUT_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
