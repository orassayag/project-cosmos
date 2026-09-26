import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectAgentModal } from '../ConnectAgentModal';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import type { ConnectResult } from '../../hooks/useAiConnection';
function Harness({ onConnect, showJevField }: { onConnect: () => Promise<ConnectResult>; showJevField?: boolean }) {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <button type="button" onClick={() => overlay.open(OVERLAY.ask)}>Open answer</button>
      <button type="button" onClick={() => overlay.open(OVERLAY.connect)}>Open connect</button>
      <ConnectAgentModal currentProvider={null} onConnect={onConnect} showJevField={showJevField} />
    </OverlayProvider>
  );
}

function renderOpenModal(connectResult: ConnectResult) {
  const onConnect = vi.fn(() => Promise.resolve(connectResult));
  render(<Harness onConnect={onConnect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));
  fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'sk-ant-test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  return { onConnect };
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

  it('shows the inline error and stays open when the key is rejected', async () => {
    const { onConnect } = renderOpenModal({ ok: false, errorCode: 'INVALID_KEY' });

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      "That key didn't work — check it and try again",
    );
    expect(onConnect).toHaveBeenCalledWith('anthropic', 'sk-ant-test');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.connect);
  });

  it('closes once the key is accepted', async () => {
    renderOpenModal({ ok: true, provider: 'anthropic' });

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('active-overlay').textContent).toBe('none');
  });

  it('stacks over the answer panel on phones and brings it back when closed', () => {
    stubPhoneViewport();
    render(<Harness onConnect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.connect);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.ask);
  });

  it('shows an editable site-owner JEV field in the demo and submits through onConnect', () => {
    const onConnect = vi.fn(() => new Promise<ConnectResult>(() => {}));
    render(<Harness onConnect={onConnect} showJevField />);
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));

    const jevKeyInput = screen.getByLabelText<HTMLInputElement>(/site owner/);
    expect(jevKeyInput.type).toBe('password');
    fireEvent.change(jevKeyInput, { target: { value: 'jev-demo-key' } });
    expect(jevKeyInput.value).toBe('jev-demo-key');

    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'sk-ant-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onConnect).toHaveBeenCalledWith('anthropic', 'sk-ant-demo');
    expect(screen.getByRole('button', { name: 'Connecting…' })).toHaveProperty('disabled', true);
  });

  it('never shows the JEV field to real visitors', () => {
    render(<Harness onConnect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open connect' }));

    expect(screen.queryByLabelText(/site owner/)).toBeNull();
    expect(screen.queryByLabelText(/Vercel AI Gateway/)).toBeNull();
  });
});
