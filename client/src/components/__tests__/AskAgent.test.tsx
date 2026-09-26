import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskAgent, STARTER_QUESTIONS } from '../AskAgent';
import type { AiConnectionStatus, AiProvider } from '../../hooks/useAiConnection';

function renderAskAgent(aiStatus: AiConnectionStatus, aiProvider: AiProvider | null = null) {
  const onAsk = vi.fn();
  const onConnectRequest = vi.fn();
  const onDisconnect = vi.fn();
  render(
    <AskAgent
      onAsk={onAsk}
      aiStatus={aiStatus}
      aiProvider={aiProvider}
      onConnectRequest={onConnectRequest}
      onDisconnect={onDisconnect}
    />,
  );
  fireEvent.focus(screen.getByPlaceholderText('Explore Project Cosmos'));
  return { onAsk, onConnectRequest, onDisconnect };
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

  it('shows a red light but no Connect button when AI is not configured on the server', () => {
    renderAskAgent('notConfigured');

    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--off');
    expect(screen.getByRole('img', { name: 'No AI agent connected' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect AI Agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect AI Agent' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('shows starter questions while the field is empty and hides them once typing starts', () => {
    renderAskAgent('disconnected');

    for (const starter of STARTER_QUESTIONS) {
      expect(screen.getByRole('button', { name: starter })).toBeTruthy();
    }

    fireEvent.change(screen.getByPlaceholderText('Explore Project Cosmos'), { target: { value: 'Who owns' } });

    expect(screen.queryByRole('group', { name: 'Example questions' })).toBeNull();
  });

  it('fills the field and submits when a starter question is picked', () => {
    const { onAsk } = renderAskAgent('disconnected');

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Which team owns checkout?' }));

    expect(onAsk).toHaveBeenCalledWith('Which team owns checkout?');
  });

  it('shows the placeholder while collapsed and restores the question on refocus', () => {
    renderAskAgent('connected', 'anthropic');
    const field = screen.getByPlaceholderText('Explore Project Cosmos');
    fireEvent.change(field, { target: { value: 'Who owns' } });
    fireEvent.blur(field);

    expect(field).toHaveProperty('value', '');

    fireEvent.focus(field);

    expect(field).toHaveProperty('value', 'Who owns');
  });
});
