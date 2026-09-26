#!/usr/bin/env node
/**
 * record-demo — play a scripted demo in a real browser and save the video.
 *
 *   npm run dev                      # in another terminal
 *   npm run record:demo -- ai|all    # writes recordings/demo-<mode>.webm
 *
 * BASE_URL overrides the app origin (default http://localhost:5173).
 * Exits non-zero if the demo aborts, never finishes, or takes longer than its
 * real-time limit — the wall-clock backstop for the unit-level duration check.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Mirrors DEMO_TIME_LIMITS_MS in client/src/demo/scripts.ts (TS inside the
// client workspace, not importable from plain Node).
const TIME_LIMITS_MS = { ai: 60_000, all: 120_000 };
const WAIT_HEADROOM_MS = 30_000;
const VIEWPORT = { width: 1920, height: 1080 };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recordingsDir = resolve(root, 'recordings');

function fail(message) {
  console.error(`record-demo: ${message}`);
  process.exit(1);
}

const mode = process.argv[2];
if (!Object.hasOwn(TIME_LIMITS_MS, mode)) {
  fail(`expected a mode of ${Object.keys(TIME_LIMITS_MS).join('|')}, got ${JSON.stringify(mode ?? null)}.\n` +
    'Usage: npm run record:demo -- ai|all');
}

const baseUrl = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const demoUrl = `${baseUrl}/?demo=${mode}`;
const limitMs = TIME_LIMITS_MS[mode];
const outputPath = resolve(recordingsDir, `demo-${mode}.webm`);

mkdirSync(recordingsDir, { recursive: true });
const videoTempDir = resolve(recordingsDir, `.tmp-${mode}-${process.pid}`);

const browser = await chromium.launch();
let exitCode = 0;
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoTempDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  const video = page.video();

  // Elapsed = navigation start → html[data-demo-state="done"], i.e. what a
  // viewer of the recording sits through, including page load.
  const startedAt = Date.now();
  try {
    await page.goto(demoUrl, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    throw new Error(`could not open ${demoUrl} (${error.message.split('\n')[0]}).\n` +
      'Start the app with `npm run dev`, or set BASE_URL to a running instance.', { cause: error });
  }

  let finalState;
  try {
    const finishedHtml = await page.waitForSelector(
      'html[data-demo-state="done"], html[data-demo-state="aborted"]',
      { state: 'attached', timeout: limitMs + WAIT_HEADROOM_MS },
    );
    finalState = await finishedHtml.getAttribute('data-demo-state');
  } catch (error) {
    finalState = `timeout (${error.message.split('\n')[0]})`;
  }
  const elapsedMs = Date.now() - startedAt;

  await context.close();

  if (finalState !== 'done') {
    await video.delete();
    exitCode = 1;
    console.error(`record-demo: demo=${mode} did not finish — state ${finalState} after ${(elapsedMs / 1000).toFixed(1)}s; no video saved.`);
  } else {
    await video.saveAs(outputPath);
    await video.delete();
    const summary = `demo=${mode} finished in ${(elapsedMs / 1000).toFixed(1)}s (limit ${limitMs / 1000}s) → ${outputPath}`;
    if (elapsedMs > limitMs) {
      exitCode = 1;
      console.error(`record-demo: OVER LIMIT — ${summary}`);
    } else {
      console.log(`record-demo: ${summary}`);
    }
  }
} catch (error) {
  exitCode = 1;
  console.error(`record-demo: ${error.message}`);
} finally {
  await browser.close();
  rmSync(videoTempDir, { recursive: true, force: true });
}
process.exit(exitCode);
