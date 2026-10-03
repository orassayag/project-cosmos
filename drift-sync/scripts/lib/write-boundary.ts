import * as path from 'node:path';

/** The only paths (relative to the cosmos repo root) the applier may write. */
export const APPLIER_WRITABLE_PATHS = ['server/src/cosmos/data/'];

export type WritePathResult = { ok: true; absolutePath: string } | { ok: false; reason: string };

/**
 * Resolves a write_file path against the cosmos repo root and accepts it only inside one of
 * `allowedPaths`. A leading "<repo-name>/" is stripped first: models sometimes prefix the repo
 * name, which would otherwise create a nested copy instead of editing the real file.
 */
export function resolveWritePath(writeRoot: string, requestedPath: string, allowedPaths: readonly string[]): WritePathResult {
  const root = path.resolve(writeRoot);
  const rootName = path.basename(root);
  const relativeRequest =
    !path.isAbsolute(requestedPath) && requestedPath.startsWith(`${rootName}/`)
      ? requestedPath.slice(rootName.length + 1)
      : requestedPath;
  const absolutePath = path.resolve(root, relativeRequest);
  const isAllowed = allowedPaths.some((allowedPath) => {
    const allowedAbsolute = path.resolve(root, allowedPath);
    return allowedPath.endsWith('/')
      ? absolutePath.startsWith(allowedAbsolute + path.sep)
      : absolutePath === allowedAbsolute;
  });
  if (!isAllowed) {
    return {
      ok: false,
      reason: `write path ${absolutePath} is outside the writable surface (${allowedPaths.join(', ')} under ${root})`,
    };
  }
  return { ok: true, absolutePath };
}
