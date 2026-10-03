import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { startCosmosFetch } from '../api/cosmosClient';
import { INTRO_SEEN_STORAGE_KEY } from '../demo/demoMode';
import { App } from '../App';
import { COSMOS_FIXTURE } from './renderWithCosmos';

vi.mock('../api/cosmosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/cosmosClient')>()),
  startCosmosFetch: vi.fn(),
}));

vi.mock('../components/WarpTransition', () => ({
  WarpTransition: () => <div data-testid="warp" />,
}));

const { data } = COSMOS_FIXTURE;
const SCENARIO = data.scenarios.find((scenario) => scenario.status === 'ready')!;
const SERVICE = data.services[0];

interface OpenStream {
  push: (event: object) => void;
  finish: () => void;
}

function installAgentServer() {
  const streams: OpenStream[] = [];
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url !== '/api/ai/ask') return Promise.resolve(Response.json({ connected: true, provider: 'anthropic' }));
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({ start: (controller) => void (streamController = controller) });
      streams.push({
        push: (event) => streamController.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
        finish: () => streamController.close(),
      });
      return Promise.resolve(new Response(body));
    }),
  );
  return streams;
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

async function openChatAndAsk(question: string) {
  vi.mocked(startCosmosFetch).mockResolvedValue(COSMOS_FIXTURE);
  render(<App />);
  const agentButton = await screen.findByRole('button', { name: 'Open the agent chat' });
  await waitFor(() => expect(agentButton.classList.contains('lc-agent-button--on')).toBe(true));
  fireEvent.click(agentButton);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await flush();
}

async function streamEvents(stream: OpenStream, events: object[], { finish = false } = {}) {
  act(() => {
    events.forEach((event) => stream.push(event));
    if (finish) stream.finish();
  });
  await flush();
  await flush();
}

const chatPanel = () => document.querySelector('.lc-chat-panel');
const chatTab = () => document.querySelector('.lc-chat-tab');
const stepPanel = () => document.querySelector('.lc-step-panel');

describe('Chat layout on desktop', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    // jsdom has no SVG geometry; playing a scenario measures the comet paths.
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', { value: () => 100, configurable: true });
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', { value: () => ({ x: 0, y: 0 }), configurable: true });
    localStorage.clear();
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.mocked(startCosmosFetch).mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the chat open while a scenario starts mid-reply, then folds it once the reply ends', async () => {
    const streams = installAgentServer();
    await openChatAndAsk('Show me the order flow');

    await streamEvents(streams[0], [
      { type: 'token', text: 'Playing it now.' },
      { type: 'action', kind: 'playScenario', scenarioId: SCENARIO.id },
    ]);
    expect(chatPanel()).not.toBeNull();
    expect(stepPanel()).toBeNull();

    await streamEvents(streams[0], [{ type: 'done' }], { finish: true });
    await waitFor(() => expect(chatTab()).not.toBeNull());
    expect(chatPanel()).toBeNull();
    expect(chatTab()?.textContent).toBe('Playing it now.');
    expect(screen.getByTestId('chat-unread-dot')).toBeTruthy();
    await waitFor(() => expect(stepPanel()).not.toBeNull());
  });

  it('reopening from the tab closes the step panel while the scenario keeps playing', async () => {
    const streams = installAgentServer();
    await openChatAndAsk('Show me the order flow');
    await streamEvents(streams[0], [
      { type: 'token', text: 'Playing it now.' },
      { type: 'action', kind: 'playScenario', scenarioId: SCENARIO.id },
      { type: 'done' },
    ], { finish: true });
    await waitFor(() => expect(chatTab()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Reopen the agent chat' }));

    expect(chatPanel()).not.toBeNull();
    await waitFor(() => expect(stepPanel()).toBeNull());
    expect(document.querySelector('.lc-controls')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('pressing A also reopens the folded chat', async () => {
    const streams = installAgentServer();
    await openChatAndAsk('Show me the order flow');
    await streamEvents(streams[0], [
      { type: 'token', text: 'Playing it now.' },
      { type: 'action', kind: 'playScenario', scenarioId: SCENARIO.id },
      { type: 'done' },
    ], { finish: true });
    await waitFor(() => expect(chatTab()).not.toBeNull());

    fireEvent.keyDown(document.body, { key: 'a' });

    expect(chatPanel()).not.toBeNull();
  });

  it('keeps the details card on the left while the chat is docked, and moves it right once the chat closes', async () => {
    const streams = installAgentServer();
    await openChatAndAsk('Where is it?');
    fireEvent.keyDown(document.body, { key: 'c' });
    await streamEvents(streams[0], [
      { type: 'token', text: 'Here.' },
      { type: 'action', kind: 'openPassport', nodeId: SERVICE.id },
      { type: 'done' },
    ], { finish: true });

    const detailsCard = () => document.querySelector('.lc-map-panel');
    await waitFor(() => expect(detailsCard()).not.toBeNull());
    expect(detailsCard()?.classList.contains('lc-map-panel--right')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Close the chat' }));

    expect(detailsCard()?.classList.contains('lc-map-panel--right')).toBe(true);
  });
});
