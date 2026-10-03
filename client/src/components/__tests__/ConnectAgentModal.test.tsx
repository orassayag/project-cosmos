import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectAgentModal } from '../ConnectAgentModal';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';

function Harness() {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <button type="button" onClick={() => overlay.open(OVERLAY.ask)}>Open answer</button>
      <button type="button" onClick={() => overlay.open(OVERLAY.connect)}>Open connect</button>
      <ConnectAgentModal />
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

describe('ConnectAgentModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains the local setup and asks for no key', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));

    expect(screen.getByRole('dialog').textContent).toContain('server/.env');
    expect(document.querySelector('input')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));

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
