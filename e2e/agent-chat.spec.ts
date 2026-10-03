import { expect, test, type Page, type Route } from '@playwright/test';
import type { CosmosResponse } from '../client/src/api/cosmos-api';

const ASK_PATH = '/api/ai/ask';
const PHONE_VIEWPORT = { width: 390, height: 844 };

interface AskRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

function serviceNode(page: Page, serviceName: string) {
  return page.locator('g.lc-service-node', {
    has: page.locator('text', { hasText: new RegExp(`^${serviceName}$`) }),
  });
}

/** The same NDJSON lines `POST /api/ai/ask` streams (parsed by client/src/components/askStream.ts). */
function toAskStream(answer: string, serviceIds: string[]): string {
  const tokens = answer.split(/(?<= )/).map((text) => ({ type: 'token', text }));
  const events = [
    ...tokens,
    { type: 'action', kind: 'highlight', serviceIds },
    { type: 'usage', inputTokens: 1200, outputTokens: 80 },
    { type: 'done' },
  ];
  return events.map((event) => JSON.stringify(event)).join('\n') + '\n';
}

interface FakeAgent {
  askBodies: AskRequestBody[];
  /** Ends the one request held open for the Stop check. */
  releaseHeldRequest: () => void;
}

const FIRST_ANSWER = 'Card charges go through payments, which calls the provider and records the result.';
const SECOND_ANSWER = 'payments belongs to the Fulfillment team.';
const HELD_QUESTION = 'Walk me through a refund';

async function fakeConnectedAgent(page: Page): Promise<FakeAgent> {
  let releaseHeldRequest = () => {};
  const heldRequest = new Promise<void>((resolve) => {
    releaseHeldRequest = resolve;
  });
  const askBodies: AskRequestBody[] = [];

  await page.route('**/api/ai/status', (route) =>
    route.fulfill({ status: 200, json: { connected: true, provider: 'anthropic' } }),
  );
  await page.route(`**${ASK_PATH}`, async (route: Route) => {
    const body = route.request().postDataJSON() as AskRequestBody;
    askBodies.push(body);
    const question = body.messages.at(-1)?.content ?? '';
    if (question === HELD_QUESTION) {
      // route.fulfill delivers a body in one piece, so "mid-stream" is a request kept open until Stop aborts it.
      await heldRequest;
      await route.abort().catch(() => {});
      return;
    }
    const answer = askBodies.length === 1 ? FIRST_ANSWER : SECOND_ANSWER;
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: toAskStream(answer, ['payments']) });
  });

  return { askBodies, releaseHeldRequest };
}

async function openMap(page: Page) {
  await page.goto('/?domain=fulfillment');
  await expect(page.locator('g.lc-service-node').first()).toBeVisible({ timeout: 20_000 });
}

async function runChatFlow(page: Page, agent: FakeAgent) {
  const chat = page.getByRole('region', { name: 'Agent chat' });
  const composer = chat.locator('[data-demo-target="agent-composer"]');

  await expect(page.getByTestId('ai-status-dot')).toHaveClass(/lc-status-dot--on/);
  await page.locator('[data-demo-target="agent-button"]').click();
  await expect(chat).toBeVisible();

  await composer.fill('How does a card charge work?');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByText(FIRST_ANSWER)).toBeVisible();
  await expect(chat.locator('.lc-chat-usage')).toHaveText('≈ 1,280 tokens');
  expect(agent.askBodies[0].messages).toHaveLength(1);

  const followUp = chat.locator('[data-demo-target="agent-followup-0"]');
  await expect(followUp).toHaveText('Who owns payments?');
  await followUp.click();
  await expect(chat.getByText(SECOND_ANSWER)).toBeVisible();
  expect(agent.askBodies[1].messages).toEqual([
    { role: 'user', content: 'How does a card charge work?' },
    { role: 'assistant', content: FIRST_ANSWER },
    { role: 'user', content: 'Who owns payments?' },
  ]);

  await composer.fill(HELD_QUESTION);
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByRole('status', { name: 'The agent is thinking' })).toBeVisible();
  await chat.getByRole('button', { name: 'Stop' }).click();
  await expect(chat.getByText('Reply stopped')).toBeVisible();
  agent.releaseHeldRequest();

  await chat.getByRole('button', { name: 'New chat' }).click();
  await expect(chat.getByText(FIRST_ANSWER)).toHaveCount(0);
  await composer.fill('Which team owns checkout?');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => agent.askBodies.length).toBe(4);
  expect(agent.askBodies[3].messages).toEqual([{ role: 'user', content: 'Which team owns checkout?' }]);
}

test('demo=ai plays the scripted chat without calling the agent', async ({ page }) => {
  const askRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === ASK_PATH) askRequests.push(request.url());
  });
  const cosmos = (await (await page.request.get('/api/cosmos')).json()) as CosmosResponse;
  const [firstTurn, secondTurn] = cosmos.data.demo.aiTour.turns;

  await page.goto('/?demo=ai');

  await expect(page.getByTestId('ai-status-dot')).toHaveClass(/lc-status-dot--on/, { timeout: 20_000 });
  const chat = page.getByRole('region', { name: 'Agent chat' });
  await expect(chat.getByText(firstTurn.question, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByText(firstTurn.scriptedAnswer.text)).toBeVisible({ timeout: 30_000 });
  await expect(serviceNode(page, 'shipping')).toHaveAttribute('data-dimmed', 'false');
  await expect(page.locator('g.lc-service-node[data-dimmed="true"]').first()).toBeAttached();

  await expect(chat.getByText(secondTurn.question, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByText(secondTurn.scriptedAnswer.text)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-demo-state', 'done', { timeout: 30_000 });

  expect(askRequests).toEqual([]);
});

test('the chat asks, follows up, stops a reply, and starts over', async ({ page }) => {
  const agent = await fakeConnectedAgent(page);
  await openMap(page);

  await runChatFlow(page, agent);

  await expect(serviceNode(page, 'payments')).toHaveAttribute('data-dimmed', 'false');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test('the chat sheet has a close button and the bot clears the playback bar', async ({ page }) => {
    const cosmos = (await (await page.request.get('/api/cosmos')).json()) as CosmosResponse;
    const scenario = cosmos.data.scenarios.find((candidate) => candidate.status === 'ready');
    if (!scenario) throw new Error('/api/cosmos lists no ready scenario to play');
    const agent = await fakeConnectedAgent(page);

    await page.goto(`/?scenario=${encodeURIComponent(scenario.id)}`);
    const bot = page.locator('[data-demo-target="agent-button"]');
    const playbackBar = page.locator('.lc-controls');
    await expect(playbackBar).toBeVisible({ timeout: 20_000 });
    // The step narration strip hides the bot on phones; closing it leaves the bot alone with the playback bar.
    await page.locator('.lc-step-panel').getByRole('button', { name: 'Close' }).click();
    await expect(playbackBar).toBeVisible();
    await expect(bot).toBeVisible();
    const botBox = await bot.boundingBox();
    const barBox = await playbackBar.boundingBox();
    if (!botBox || !barBox) throw new Error('the bot or the playback bar has no layout box');
    expect(botBox.y + botBox.height).toBeLessThanOrEqual(barBox.y);

    await openMap(page);
    await runChatFlow(page, agent);

    const chat = page.getByRole('region', { name: 'Agent chat' });
    const closeButton = chat.getByRole('button', { name: 'Close the chat' });
    await expect(closeButton).toBeVisible();
    const chatBox = await chat.boundingBox();
    const closeBox = await closeButton.boundingBox();
    if (!chatBox || !closeBox) throw new Error('the chat sheet or its close button has no layout box');
    expect(closeBox.x + closeBox.width / 2).toBeGreaterThan(chatBox.x + chatBox.width / 2);
    expect(closeBox.y - chatBox.y).toBeLessThan(80);

    await closeButton.click();
    await expect(chat).toBeHidden();
  });
});
