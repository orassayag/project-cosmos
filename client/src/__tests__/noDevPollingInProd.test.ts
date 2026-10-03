// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';

const CLIENT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

async function buildProductionJs(): Promise<string> {
  // Vite derives import.meta.env.DEV from NODE_ENV, which Vitest sets to 'test'.
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let result: Awaited<ReturnType<typeof build>>;
  try {
    result = await build({
      root: CLIENT_ROOT,
      configFile: `${CLIENT_ROOT}vite.config.ts`,
      mode: 'production',
      logLevel: 'silent',
      build: { write: false },
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
  return outputs
    .flatMap((output) => output.output)
    .filter((chunk): chunk is Rollup.OutputChunk => chunk.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n');
}

describe('production bundle', () => {
  it('ships the cosmos fetch but none of the dev polling', async () => {
    const bundle = await buildProductionJs();

    expect(bundle).toContain('/api/cosmos');
    expect(bundle).not.toContain('If-None-Match');
    expect(bundle).not.toContain('no-store');
  }, 120_000);
});
