import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useCosmos } from '../api/CosmosProvider';
import type { AgentChatMessage, AgentReplyMessage } from '../hooks/useAgentChat';
import { formatUsage, splitEmphasis } from './askStream';
import { suggestFollowUps } from './followUps';

export const QUESTION_MAX_LENGTH = 500;
export const COUNTER_THRESHOLD = 400;

export const STARTER_QUESTIONS = [
  'What happens when a payment fails?',
  'Which team owns checkout?',
  'Play the order flow',
];

/** `collapsed` is the desktop tab the chat folds into once a reply finishes behind a right-side panel. */
export type AgentChatView = 'open' | 'collapsed';

interface AgentChatProps {
  messages: readonly AgentChatMessage[];
  isStreaming: boolean;
  view: AgentChatView;
  /** Buried under another surface on a phone — stays mounted so the draft survives. */
  hidden?: boolean;
  hasUnread?: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onRetry: (errorMessageId: string) => void;
  onClose: () => void;
  onExpand: () => void;
}

function EmphasizedText({ text }: { text: string }) {
  return (
    <>
      {splitEmphasis(text).map((segment, index) =>
        segment.isEmphasized ? <em key={index}>{segment.text}</em> : segment.text,
      )}
    </>
  );
}

interface ChipRowProps {
  label: string;
  questions: readonly string[];
  onPick: (question: string) => void;
  /** The demo taps the first chip of this row. */
  firstChipDemoTarget?: string;
}

function ChipRow({ label, questions, onPick, firstChipDemoTarget }: ChipRowProps) {
  return (
    <div className="lc-chat-chips" role="group" aria-label={label}>
      {questions.map((question, index) => (
        <button
          key={question}
          type="button"
          className="lc-chat-chip"
          data-demo-target={index === 0 ? firstChipDemoTarget : undefined}
          onClick={() => onPick(question)}
        >
          {question}
        </button>
      ))}
    </div>
  );
}

function ReplyBubble({ reply }: { reply: AgentReplyMessage }) {
  if (reply.status === 'streaming' && reply.content === '') {
    return (
      <div className="lc-chat-thinking" role="status" aria-label="The agent is thinking">
        <span className="lc-chat-dot" />
        <span className="lc-chat-dot" />
        <span className="lc-chat-dot" />
      </div>
    );
  }
  return (
    <div className="lc-chat-reply">
      {reply.content !== '' && (
        <div className="lc-chat-bubble lc-chat-bubble--streaming">
          <EmphasizedText text={reply.content} />
          {reply.status === 'streaming' && <span className="lc-chat-cursor" aria-hidden="true" />}
        </div>
      )}
      {reply.status === 'stopped' && <p className="lc-chat-note">Reply stopped</p>}
      {reply.status === 'done' && reply.usage !== null && (
        <p className="lc-chat-usage">{formatUsage(reply.usage.inputTokens, reply.usage.outputTokens)}</p>
      )}
    </div>
  );
}

function latestLine(messages: readonly AgentChatMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return 'Ask the agent';
  const lines = lastMessage.content.split('\n').filter((line) => line.trim() !== '');
  return lines[lines.length - 1] ?? 'Ask the agent';
}

/** Renders `useAgentChat` state only; App owns the request, so closing this never cuts a reply short. */
export function AgentChat({
  messages,
  isStreaming,
  view,
  hidden = false,
  hasUnread = false,
  onSend,
  onStop,
  onNewChat,
  onRetry,
  onClose,
  onExpand,
}: AgentChatProps) {
  const { data } = useCosmos();
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  const finishedReply = !isStreaming && lastMessage?.role === 'assistant' && lastMessage.status === 'done' ? lastMessage : null;
  const followUps = useMemo(
    () => (finishedReply ? finishedReply.followUps ?? suggestFollowUps(finishedReply, data) : []),
    [finishedReply, data],
  );

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages, followUps, view]);

  const isAtLimit = draft.length >= QUESTION_MAX_LENGTH;
  const canSend = draft.trim() !== '' && !isAtLimit && !isStreaming;

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  if (view === 'collapsed') {
    return (
      <button type="button" className="lc-chat-tab" data-no-pan="true" hidden={hidden} onClick={onExpand} aria-label="Reopen the agent chat">
        {hasUnread && <span className="lc-chat-tab-dot" data-testid="chat-unread-dot" />}
        <span className="lc-chat-tab-line">{latestLine(messages)}</span>
      </button>
    );
  }

  return (
    <section
      className="lc-chat-panel"
      data-no-pan="true"
      aria-label="Agent chat"
      hidden={hidden}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="lc-chat-header">
        <span className="lc-chat-title">Ask the agent</span>
        <div className="lc-chat-header-actions">
          {messages.length > 0 && (
            <button type="button" className="lc-chat-new" onClick={onNewChat}>
              New chat
            </button>
          )}
          <button type="button" className="lc-chat-close" onClick={onClose} aria-label="Close the chat">
            <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="lc-chat-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="lc-chat-start">
            <p className="lc-chat-start-text">Ask about any service, flow, or team on the map.</p>
            <ChipRow label="Example questions" questions={STARTER_QUESTIONS} onPick={onSend} />
          </div>
        ) : (
          messages.map((message) => {
            if (message.role === 'user') {
              return (
                <div key={message.id} className="lc-chat-msg lc-chat-msg--user">
                  <div className="lc-chat-bubble">{message.content}</div>
                </div>
              );
            }
            if (message.role === 'error') {
              return (
                <div key={message.id} className="lc-chat-msg lc-chat-msg--error">
                  <div className="lc-chat-bubble" role="alert">
                    {message.content}
                    <button type="button" className="lc-chat-retry" onClick={() => onRetry(message.id)}>
                      Try again
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={message.id} className="lc-chat-msg lc-chat-msg--assistant">
                <ReplyBubble reply={message} />
              </div>
            );
          })
        )}
        {followUps.length > 0 && (
          <ChipRow label="Suggested follow-ups" questions={followUps} onPick={onSend} firstChipDemoTarget="agent-followup-0" />
        )}
      </div>

      <div className="lc-chat-footer">
        <div className="lc-chat-composer">
          <textarea
            className="lc-chat-input"
            data-demo-target="agent-composer"
            aria-label="Your question"
            placeholder="Ask about the map"
            rows={2}
            spellCheck={false}
            maxLength={QUESTION_MAX_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          {draft.length > COUNTER_THRESHOLD && (
            <span className="lc-chat-counter" data-at-limit={isAtLimit} aria-live="polite">
              {draft.length} / {QUESTION_MAX_LENGTH}
            </span>
          )}
        </div>
        {isStreaming ? (
          <button type="button" className="lc-chat-send lc-chat-send--stop" onClick={onStop} aria-label="Stop">
            <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
              <rect x={2} y={2} width={8} height={8} rx={1.5} fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="lc-chat-send"
            data-demo-target="agent-send"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 12 V2 M2.5 6.5 L7 2 L11.5 6.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
