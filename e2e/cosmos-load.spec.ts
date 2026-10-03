import { expect, test, type Page } from '@playwright/test';
import type { CosmosResponse } from '../client/src/api/cosmos-api';

const COSMOS_PATH = '/api/cosmos';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens a deep link (which skips the intro) and returns every `/api/cosmos` response the page received. */
async function openDeepLinkedMap(page: Page, path: string) {
  const cosmosStatuses: number[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === COSMOS_PATH) cosmosStatuses.push(response.status());
  });
  await page.goto(path);
  await expect(page.locator('g.lc-service-node').first()).toBeVisible({ timeout: 20_000 });
  return cosmosStatuses;
}

async function readCosmos(page: Page): Promise<CosmosResponse> {
  const response = await page.request.get(COSMOS_PATH);
  expect(response.status()).toBe(200);
  return (await response.json()) as CosmosResponse;
}

test('a deep link loads the map from exactly one /api/cosmos request', async ({ page }) => {
  const cosmosStatuses = await openDeepLinkedMap(page, '/?domain=shopping');

  await expect(page.locator('.lc-intro')).toHaveCount(0);
  expect(cosmosStatuses).toEqual([200]);
});

test('clicking a capsule opens its passport with the label from the response', async ({ page }) => {
  const cosmos = await readCosmos(page);
  const service = cosmos.data.services.find((candidate) => candidate.id === 'payments') ?? cosmos.data.services[0];
  await openDeepLinkedMap(page, '/?domain=shopping');

  await page
    .locator('g.lc-service-node', { has: page.locator('text', { hasText: new RegExp(`^${escapeRegExp(service.name)}$`) }) })
    .locator('rect[pointer-events="all"]')
    .first()
    .click({ force: true });

  await expect(page.locator('.lc-map-panel-title-row h3')).toHaveText(service.name);
});

test('playing a scenario from the UI advances the step panel', async ({ page }) => {
  const cosmos = await readCosmos(page);
  const scenario = cosmos.data.scenarios.find((candidate) => candidate.status === 'ready');
  if (!scenario) throw new Error('/api/cosmos lists no ready scenario to play');
  await openDeepLinkedMap(page, `/?domain=${encodeURIComponent(scenario.domain)}`);

  await page.locator(`[data-demo-target="domain-${scenario.domain}"]`).click();
  await page.locator(`[data-demo-target="scenario-${scenario.id}"]`).click();
  await page.locator('[data-demo-target="playback-play"]').click();

  await expect(page.locator('.lc-step-panel-counter')).toHaveText(/^([2-9]|\d{2,}) \/ \d+$/, { timeout: 30_000 });
});

test('/api/cosmos answers 304 when If-None-Match carries its ETag', async ({ request }) => {
  const first = await request.get(COSMOS_PATH);
  expect(first.status()).toBe(200);
  const etag = first.headers()['etag'];
  expect(etag).toBeTruthy();

  const revalidated = await request.get(COSMOS_PATH, { headers: { 'If-None-Match': etag } });

  expect(revalidated.status()).toBe(304);
});
