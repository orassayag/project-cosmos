import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectAgentModal } from '../ConnectAgentModal';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import type { AiConnectionStatus } from '../../hooks/useAiConnection';

const LIVE_SITE_LINE = 'Live answers are only available when running the project locally.';

function Harness({ status = 'notLocal' }: { status?: AiConnectionStatus }) {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <button type="button" onClick={() => overlay.open(OVERLAY.ask)}>Open answer</button>
      <button type="button" onClick={() => overlay.open(OVERLAY.connect)}>Open connect</button>
      <ConnectAgentModal status={status} />
    </OverlayProvider>
  );
}

function stubPhoneViewport() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 768px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function openSetup(status?: AiConnectionStatus) {
  render(<Harness status={status} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));
  return screen.getByRole('dialog');
}

describe('ConnectAgentModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for no input and names every env var and setup step', () => {
    const dialog = openSetup();

    expect(dialog.querySelector('input, textarea, select')).toBeNull();
    for (const text of ['server/.env.example', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_GATEWAY_API_KEY', 'pnpm dev']) {
      expect(dialog.textContent).toContain(text);
    }
    expect(dialog.querySelectorAll('ol > li pre')).toHaveLength(4);
  });

  it('notes that questions are billed to the configured key', () => {
    expect(openSetup().textContent).toContain('Questions are billed to the AI account whose key you set.');
  });

  it('shows the live-site line when the agent is not local', () => {
    const dialog = openSetup('notLocal');

    expect(dialog.textContent).toContain(LIVE_SITE_LINE);
    expect(dialog.textContent).not.toContain('No AI key is set yet.');
  });

  it('says no key is set, without the live-site line, when running locally without one', () => {
    const dialog = openSetup('notConfigured');

    expect(dialog.textContent).toContain('No AI key is set yet.');
    expect(dialog.textContent).not.toContain(LIVE_SITE_LINE);
  });

  it('uses the live-site wording while the status is still unknown', () => {
    expect(openSetup('unknown').textContent).toContain(LIVE_SITE_LINE);
  });

  it('closes from its top-right close button', () => {
    openSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('active-overlay').textContent).toBe('none');
  });

  it('closes on Escape', () => {
    openSetup();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('active-overlay').textContent).toBe('none');
  });

  it('stacks over the answer panel on phones and brings it back when closed', () => {
    stubPhoneViewport();
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.connect);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.ask);
  });
});
