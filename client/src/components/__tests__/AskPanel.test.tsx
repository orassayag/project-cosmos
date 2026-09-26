import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AskPanel } from '../AskPanel';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';

const CONNECT_PROMPT = 'Connect an AI agent for real answers.';

function Harness({ showConnectPrompt }: { showConnectPrompt: boolean }) {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <AskPanel
        question="Which team owns checkout?"
        onClose={() => overlay.close(OVERLAY.ask)}
        showConnectPrompt={showConnectPrompt}
        onConnectRequest={() => overlay.open(OVERLAY.connect)}
      />
    </OverlayProvider>
  );
}

function finishJokeAnswer() {
  for (let tick = 0; tick < 200; tick += 1) {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

describe('AskPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends the joke answer with a Connect prompt that opens the connect modal', () => {
    render(<Harness showConnectPrompt />);

    expect(screen.queryByRole('button', { name: CONNECT_PROMPT })).toBeNull();
    finishJokeAnswer();

    fireEvent.click(screen.getByRole('button', { name: CONNECT_PROMPT }));

    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.connect);
  });

  it('shows no Connect prompt when an agent is connected', () => {
    render(<Harness showConnectPrompt={false} />);

    finishJokeAnswer();

    expect(screen.getByText(/./, { selector: '.lc-ask-answer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: CONNECT_PROMPT })).toBeNull();
  });
});
