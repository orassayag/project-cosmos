import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskAgent } from '../AskAgent';
import type { AiConnectionStatus, AiProvider } from '../../hooks/useAiConnection';

function renderAskAgent(aiStatus: AiConnectionStatus, aiProvider: AiProvider | null = null) {
  const onConnectRequest = vi.fn();
  const onDisconnect = vi.fn();
  render(
    <AskAgent
      onAsk={vi.fn()}
      aiStatus={aiStatus}
      aiProvider={aiProvider}
      onConnectRequest={onConnectRequest}
      onDisconnect={onDisconnect}
    />,
  );
  fireEvent.focus(screen.getByPlaceholderText('Explore Project Cosmos'));
  return { onConnectRequest, onDisconnect };
}

describe('AskAgent', () => {
  it('labels the submit button "Search", not "Go!"', () => {
    renderAskAgent('disconnected');

    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go!' })).toBeNull();
  });

  it('offers Connect and shows a red light when no agent is connected', () => {
    const { onConnectRequest } = renderAskAgent('disconnected');

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Connect AI Agent' }));

    expect(onConnectRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Disconnect AI Agent' })).toBeNull();
    expect(screen.getByRole('img', { name: 'No AI agent connected' })).toBeTruthy();
    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--off');
  });

  it('offers Disconnect and shows a green light when an agent is connected', () => {
    const { onDisconnect } = renderAskAgent('connected', 'anthropic');

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Disconnect AI Agent' }));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Connect AI Agent' })).toBeNull();
    expect(screen.getByRole('img', { name: 'AI agent connected (Claude)' })).toBeTruthy();
    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--on');
  });

  it('renders a grey light and no connection button while the status is unknown', () => {
    renderAskAgent('unknown');

    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--unknown');
    expect(screen.queryByRole('button', { name: 'Connect AI Agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect AI Agent' })).toBeNull();
  });
});
