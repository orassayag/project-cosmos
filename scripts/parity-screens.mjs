#!/usr/bin/env node
/**
 * parity-screens — screenshot every baseline view and diff it against
 * docs/plans/baseline-screens/ (the migration's visual parity oracle).
 *
 *   npm run parity:screens                 # build, preview, compare (exit 1 if any view is over threshold)
 *   npm run parity:screens -- --update     # rewrite the baseline PNGs
 *   npm run parity:screens -- --only default-map,blast-payments
 *   npm run parity:screens -- --skip-build # reuse client/dist
 *
 * BASE_URL points at an already-running app instead of building and starting `vite preview`.
 * Diffs and the retaken shots land in parity-out/ (gitignored).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };
const PHONE_VIEWPORT = { width: 390, height: 844 };
const MAX_DIFF_RATIO = 0.001;
const PIXEL_COLOR_THRESHOLD = 0.1;
const PREVIEW_PORT = 4317;
const FROZEN_TIME = new Date('2026-08-14T12:00:00Z');
const SETTLE_AFTER_LOAD_MS = 6_000;
const SETTLE_AFTER_ACTION_MS = 3_000;
// CSS transitions and keyframes run on the real clock, which page.clock does not control,
// so they are switched off: every shot shows each element's settled end state.
const FREEZE_CSS = '*, *::before, *::after { transition: none !important; animation: none !important; }';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineDir = resolve(root, 'docs/plans/baseline-screens');
const outputDir = resolve(root, 'parity-out');
const baselineFixture = JSON.parse(
  readFileSync(resolve(root, 'server/src/__tests__/fixtures/baseline-full.json'), 'utf8'),
);

function fail(message) {
  console.error(`parity-screens: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { update: false, skipBuild: false, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--update') options.update = true;
    else if (argument === '--skip-build') options.skipBuild = true;
    else if (argument === '--only') options.only = new Set((argv[++index] ?? '').split(',').filter(Boolean));
    else fail(`unknown argument ${JSON.stringify(argument)} (expected --update, --skip-build, --only <a,b>)`);
  }
  return options;
}

const STEP_SETTLE_MS = 3_000;

// The `?step=` deep link lands on step 1 (observed in Phase 0), so mid-play is reached by pressing Next.
function stepForwardToMiddle(steps) {
  return async (page) => {
    const forwardButton = page.locator('[data-demo-target="playback-step-forward"]');
    for (let press = 1; press < Math.ceil(steps.length / 2); press += 1) {
      await forwardButton.click({ force: true });
      await page.clock.runFor(STEP_SETTLE_MS);
    }
  };
}

function serviceHitArea(page, serviceName) {
  return page
    .locator('g.lc-service-node', { has: page.locator('text', { hasText: new RegExp(`^${serviceName}$`) }) })
    .locator('rect[pointer-events="all"]')
    .first();
}

// Every view is reached through the real UI: a deep link, a keyboard shortcut, or a click.
const VIEWS = [
  { name: 'default-map', path: '/' },
  ...baselineFixture.data.SCENARIOS.filter((scenario) => scenario.status === 'ready').map((scenario) => ({
    name: `scenario-${scenario.id}`,
    path: `/?scenario=${encodeURIComponent(scenario.id)}`,
    act: stepForwardToMiddle(baselineFixture.data.STEPS_BY_SCENARIO[scenario.id]),
  })),
  ...baselineFixture.data.INCIDENTS.map((incident) => ({
    name: `incident-${incident.id}`,
    path: `/?incident=${encodeURIComponent(incident.id)}`,
    act: stepForwardToMiddle(incident.steps),
  })),
  {
    name: 'blast-payments',
    path: '/',
    act: async (page) => {
      await page.keyboard.press('b');
      await serviceHitArea(page, 'payments').click({ force: true });
    },
  },
  { name: 'health-view', path: '/', act: (page) => page.keyboard.press('h') },
  { name: 'ownership-view', path: '/', act: (page) => page.keyboard.press('o') },
  { name: 'drift-overlay', path: '/', act: (page) => page.keyboard.press('c') },
  {
    name: 'changelog-open',
    path: '/',
    act: (page) => page.getByRole('button', { name: 'Changelog', exact: true }).click({ force: true }),
  },
  {
    // `expandedServiceId` is a constant null in Map.tsx, so the expanded ecosystem
    // is unreachable; selecting the hub (inspector with its sub-services) is the closest real view.
    name: 'realtime-hub-selected',
    path: '/',
    act: (page) => serviceHitArea(page, 'realtime-hub').click({ force: true }),
  },
  { name: 'mobile-default-map', path: '/', viewport: PHONE_VIEWPORT, phone: true },
];

// Seeded Math.random (starfields and ambient packets are random per load) and the intro skipped.
function prepareBrowser() {
  let state = 0x9e3779b9;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  globalThis.localStorage.setItem('cosmos-intro-seen', '1');
}

// The app now loads its data from /api/cosmos, which `vite preview` has no backend for, so every
// shot is served the exact body the server would send (read once from the server module).
function readCosmosBody() {
  const result = spawnSync(
    resolve(root, 'node_modules/.bin/tsx'),
    [
      '--eval',
      "import('./server/src/cosmos/view.ts').then(({ getCosmosResponseBody }) => process.stdout.write(getCosmosResponseBody().json))",
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 || !result.stdout) fail(`could not read the /api/cosmos body: ${result.stderr || 'empty output'}`);
  return result.stdout;
}

// The freeze ships inside the served HTML: a style appended from an init script does not survive the
// parser building the document, and one added after `load` misses the shell's first camera fit.
async function serveDocumentWithFrozenAnimations(route) {
  const response = await route.fetch();
  const html = await response.text();
  if (!html.includes('</head>')) throw new Error(`no </head> in ${route.request().url()} — cannot inject the animation freeze`);
  await route.fulfill({ response, body: html.replace('</head>', `<style data-parity-freeze>${FREEZE_CSS}</style></head>`) });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await delay(250);
  }
  throw new Error(`no response from ${url} within ${timeoutMs / 1000}s`);
}

async function startPreview(skipBuild) {
  if (!skipBuild) {
    const build = spawnSync('npm', ['run', 'build', '--workspace', 'client'], { cwd: root, stdio: 'inherit' });
    if (build.status !== 0) fail('client build failed');
  }
  if (!existsSync(resolve(root, 'client/dist/index.html'))) fail('client/dist is missing — run without --skip-build');
  const preview = spawn(
    resolve(root, 'node_modules/.bin/vite'),
    ['preview', '--port', String(PREVIEW_PORT), '--strictPort'],
    { cwd: resolve(root, 'client'), stdio: 'ignore' },
  );
  const baseUrl = `http://localhost:${PREVIEW_PORT}`;
  try {
    await waitForServer(baseUrl, 30_000);
  } catch (error) {
    preview.kill('SIGTERM');
    throw error;
  }
  return { baseUrl, stop: () => preview.kill('SIGTERM') };
}

async function captureView(browser, baseUrl, view, cosmosBody) {
  const viewport = view.viewport ?? DESKTOP_VIEWPORT;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: Boolean(view.phone),
    isMobile: Boolean(view.phone),
  });
  try {
    await context.addInitScript(prepareBrowser);
    // The AI status probe has no backend under `vite preview`; answer it the same way every run.
    await context.route('**/api/**', (route) => route.fulfill({ status: 404, body: '' }));
    // Registered later, so it wins over the 404 stub for this one path.
    await context.route('**/api/cosmos', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json; charset=UTF-8', body: cosmosBody }),
    );
    await context.route(
      (url) => url.href.startsWith(baseUrl),
      (route) => (route.request().resourceType() === 'document' ? serveDocumentWithFrozenAnimations(route) : route.fallback()),
    );
    // Web fonts arrive at a racy moment relative to the first camera fit (which measures the
    // layout), so shots always use the fallback fonts; this also keeps the command offline-safe.
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    const page = await context.newPage();
    await page.clock.install({ time: FROZEN_TIME });
    // Paused, so only runFor moves time: the shell mounts whenever /api/cosmos answers (real time),
    // and a flowing clock would give the camera a different number of frames to settle in each run.
    await page.clock.pauseAt(new Date(FROZEN_TIME.getTime() + 1_000));
    await page.goto(`${baseUrl}${view.path}`, { waitUntil: 'load' });
    // The shell mounts only once /api/cosmos answers; settle time is counted from then.
    await page.locator('.lc-app').waitFor({ state: 'attached', timeout: 15_000 });
    await page.clock.runFor(SETTLE_AFTER_LOAD_MS);
    if (view.act) {
      await view.act(page);
      await page.clock.runFor(SETTLE_AFTER_ACTION_MS);
    }
    const liveCssAnimations = await page.evaluate(
      () =>
        globalThis.document
          .getAnimations()
          .filter((animation) => animation instanceof globalThis.CSSAnimation || animation instanceof globalThis.CSSTransition).length,
    );
    if (liveCssAnimations > 0) throw new Error(`${view.name}: ${liveCssAnimations} CSS animation(s) still running — the freeze did not apply`);
    return await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      // The version badge changes with every commit, not with the map.
      mask: [page.locator('.lc-topbar-version')],
    });
  } finally {
    await context.close();
  }
}

function compare(baselinePng, actualPng) {
  const baseline = PNG.sync.read(baselinePng);
  const actual = PNG.sync.read(actualPng);
  const totalPixels = actual.width * actual.height;
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return { diffPixels: totalPixels, totalPixels, diffPng: null };
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, actual.width, actual.height, {
    threshold: PIXEL_COLOR_THRESHOLD,
  });
  return { diffPixels, totalPixels, diffPng: PNG.sync.write(diff) };
}

const options = parseArgs(process.argv.slice(2));
const views = options.only ? VIEWS.filter((view) => options.only.has(view.name)) : VIEWS;
if (options.only && views.length !== options.only.size) {
  fail(`unknown view in --only; known views: ${VIEWS.map((view) => view.name).join(', ')}`);
}

mkdirSync(baselineDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const server = process.env.BASE_URL
  ? { baseUrl: process.env.BASE_URL.replace(/\/+$/, ''), stop: () => {} }
  : await startPreview(options.skipBuild);
const cosmosBody = readCosmosBody();
const browser = await chromium.launch();
const failures = [];
try {
  for (const view of views) {
    const shot = await captureView(browser, server.baseUrl, view, cosmosBody);
    const baselinePath = resolve(baselineDir, `${view.name}.png`);
    if (options.update) {
      writeFileSync(baselinePath, shot);
      console.log(`  updated  ${view.name}`);
      continue;
    }
    writeFileSync(resolve(outputDir, `${view.name}.png`), shot);
    if (!existsSync(baselinePath)) {
      failures.push(view.name);
      console.log(`  ❌ ${view.name} — no baseline (run with --update)`);
      continue;
    }
    const { diffPixels, totalPixels, diffPng } = compare(readFileSync(baselinePath), shot);
    if (diffPng) writeFileSync(resolve(outputDir, `${view.name}.diff.png`), diffPng);
    const ratio = diffPixels / totalPixels;
    const isOver = ratio > MAX_DIFF_RATIO;
    if (isOver) failures.push(view.name);
    console.log(
      `  ${isOver ? '❌' : '✅'} ${view.name} — ${diffPixels} px differ (${(ratio * 100).toFixed(4)}%)${diffPng ? '' : ' [size changed]'}`,
    );
  }
} finally {
  await browser.close();
  server.stop();
}

if (options.update) {
  console.log(`parity-screens: wrote ${views.length} baseline(s) to ${baselineDir}`);
} else if (failures.length > 0) {
  console.error(
    `parity-screens: ${failures.length} view(s) over ${MAX_DIFF_RATIO * 100}% — ${failures.join(', ')} (diffs in ${outputDir})`,
  );
  process.exit(1);
} else {
  console.log(`parity-screens: ${views.length} view(s) within ${MAX_DIFF_RATIO * 100}%`);
}
