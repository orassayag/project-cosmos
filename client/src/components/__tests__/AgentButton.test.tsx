import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentButton } from '../AgentButton';
import type { AiConnectionStatus, AiProvider } from '../../hooks/useAiConnection';

function renderAgentButton(status: AiConnectionStatus, provider: AiProvider | null = null) {
  const onOpenChat = vi.fn();
  const onOpenSetup = vi.fn();
  render(<AgentButton status={status} provider={provider} onOpenChat={onOpenChat} onOpenSetup={onOpenSetup} />);
  const button = screen.getByRole('button', { name: 'Open the agent chat' });
  return { button, onOpenChat, onOpenSetup };
}

describe('AgentButton', () => {
  it('is green and opens the chat when the agent is connected', () => {
    const { button, onOpenChat, onOpenSetup } = renderAgentButton('connected', 'anthropic');

    fireEvent.click(button);

    expect(button.classList.contains('lc-agent-button--on')).toBe(true);
    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--on');
    expect(button.getAttribute('title')).toBe('AI agent connected (Claude)');
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpenSetup).not.toHaveBeenCalled();
  });

  it.each(['notLocal', 'notConfigured'] as const)('is red and opens the setup window when the status is %s', (status) => {
    const { button, onOpenChat, onOpenSetup } = renderAgentButton(status);

    fireEvent.click(button);

    expect(button.classList.contains('lc-agent-button--off')).toBe(true);
    expect(screen.getByTestId('ai-status-dot').className).toBe('lc-status-dot lc-status-dot--off');
    expect(button.getAttribute('title')).toBe('No AI agent connected');
    expect(onOpenSetup).toHaveBeenCalledTimes(1);
    expect(onOpenChat).not.toHaveBeenCalled();
  });

  it('is grey and opens the setup window while the status is still unknown', () => {
    const { button, onOpenChat, onOpenSetup } = renderAgentButton('unknown');

    fireEvent.click(button);

    expect(button.classList.contains('lc-agent-button--unknown')).toBe(true);
    expect(onOpenSetup).toHaveBeenCalledTimes(1);
    expect(onOpenChat).not.toHaveBeenCalled();
  });
});
