import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { startCosmosFetch } from '../api/cosmosClient';
import { INTRO_SEEN_STORAGE_KEY } from '../demo/demoMode';
import { HelpModal } from '../components/HelpModal';
import { App } from '../App';
import { COSMOS_FIXTURE, renderWithCosmos } from './renderWithCosmos';

vi.mock('../api/cosmosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/cosmosClient')>()),
  startCosmosFetch: vi.fn(),
}));

vi.mock('../components/WarpTransition', () => ({
  WarpTransition: () => <div data-testid="warp" />,
}));

function stubStatus(response: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
}

async function renderApp(expectedButtonClass: string) {
  vi.mocked(startCosmosFetch).mockResolvedValue(COSMOS_FIXTURE);
  render(<App />);
  await waitFor(() => expect(document.querySelector(`.lc-agent-button.${expectedButtonClass}`)).not.toBeNull());
}

function isAnswerPanelVisible() {
  const panel = document.querySelector<HTMLElement>('.lc-chat-panel');
  return panel !== null && !panel.hidden;
}

describe('A key toggles the agent', () => {
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
    localStorage.clear();
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.mocked(startCosmosFetch).mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens and closes the chat when the agent is connected', async () => {
    stubStatus(() => Response.json({ connected: true, provider: 'anthropic' }));
    await renderApp('lc-agent-button--on');

    fireEvent.keyDown(document.body, { key: 'a' });
    expect(isAnswerPanelVisible()).toBe(true);

    fireEvent.keyDown(document.body, { key: 'A' });
    expect(isAnswerPanelVisible()).toBe(false);
  });

  it('opens and closes the setup window with the not-configured wording when no key is set', async () => {
    stubStatus(() => Response.json({ errorCode: 'AI_NOT_CONFIGURED' }, { status: 503 }));
    await renderApp('lc-agent-button--off');

    fireEvent.keyDown(document.body, { key: 'a' });
    expect(screen.getByRole('dialog').textContent).toContain('No AI key is set yet.');

    fireEvent.keyDown(document.body, { key: 'a' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores the key with a modifier or while typing', async () => {
    stubStatus(() => Response.json({ errorCode: 'AI_NOT_LOCAL' }, { status: 503 }));
    await renderApp('lc-agent-button--off');

    fireEvent.keyDown(document.body, { key: 'a', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'a' });
    field.remove();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is listed in the keyboard help', () => {
    renderWithCosmos(<HelpModal open onClose={() => {}} />);

    const shortcut = screen.getAllByText('A').find((element) => element.classList.contains('lc-help-kbd'));
    expect(shortcut?.parentElement?.textContent).toContain('opens and closes the agent');
  });
});
