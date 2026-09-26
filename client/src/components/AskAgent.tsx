import { useCallback, useEffect, useRef, useState } from 'react';
import { AI_PROVIDER_LABELS, type AiConnectionStatus, type AiProvider } from '../hooks/useAiConnection';

interface AskAgentProps {
  onAsk: (question: string) => void;
  /** Bumped by the "Project Cosmos" reset / global Esc — clears the typed question. */
  resetNonce?: number;
  aiStatus: AiConnectionStatus;
  aiProvider: AiProvider | null;
  onConnectRequest: () => void;
  onDisconnect: () => void;
  /** Demo runner overrides: when set, these replace the visitor-driven state. */
  demoQuestion?: string;
  demoExpanded?: boolean;
  demoSearchPressed?: boolean;
}

export const STARTER_QUESTIONS = [
  'What happens when a payment fails?',
  'Which team owns checkout?',
  'Play the order flow',
];

const DOT_MODIFIER: Record<AiConnectionStatus, string> = {
  connected: 'on',
  disconnected: 'off',
  notConfigured: 'off',
  unknown: 'unknown',
};

function botLabel(status: AiConnectionStatus, provider: AiProvider | null): string {
  if (status === 'connected') return `AI agent connected (${provider ? AI_PROVIDER_LABELS[provider] : 'unknown provider'})`;
  if (status === 'disconnected' || status === 'notConfigured') return 'No AI agent connected';
  return 'Checking for an AI agent';
}

/**
 * Topbar "Ask the agent" field. Collapsed it reads as a one-line input with
 * no button; focusing it grows the field into a card holding the textarea and
 * a Search button at the bottom. Blur or Search collapses it back, keeping the text;
 * refocusing, Esc, or a galaxy reset clears it for a fresh question.
 */
export function AskAgent({
  onAsk,
  resetNonce = 0,
  aiStatus,
  aiProvider,
  onConnectRequest,
  onDisconnect,
  demoQuestion,
  demoExpanded,
  demoSearchPressed = false,
}: AskAgentProps) {
  const [isExpandedInternal, setExpanded] = useState(false);
  const [typedQuestion, setQuestion] = useState('');
  const isDemoQuestion = demoQuestion !== undefined;
  const expanded = demoExpanded ?? isExpandedInternal;
  const question = demoQuestion ?? typedQuestion;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // A galaxy reset ("Project Cosmos" title / global Esc) wipes the field too.
  useEffect(() => {
    if (resetNonce === 0) return;
    setQuestion('');
    setExpanded(false);
  }, [resetNonce]);

  // The map's pan handler calls preventDefault on background pointerdown,
  // which swallows the textarea's blur — so a plain click outside never
  // collapses the field. Collapse explicitly on any pointerdown outside.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setExpanded(false);
        areaRef.current?.blur();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [expanded]);

  const submit = useCallback(() => {
    const trimmed = question.trim();
    if (!trimmed) {
      areaRef.current?.focus();
      return;
    }
    onAsk(trimmed);
    // Collapse but keep the text — blur triggers the shrink via onBlur.
    areaRef.current?.blur();
  }, [question, onAsk]);

  const askStarter = useCallback(
    (starter: string) => {
      setQuestion(starter);
      onAsk(starter);
      areaRef.current?.blur();
    },
    [onAsk],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isDemoQuestion) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        setQuestion('');
        areaRef.current?.blur();
      }
    },
    [submit, isDemoQuestion],
  );

  const statusLabel = botLabel(aiStatus, aiProvider);
  const showStarters = expanded && question === '' && !isDemoQuestion;

  return (
    <div
      ref={rootRef}
      className={`lc-ask${expanded ? ' lc-ask--expanded' : ''}${showStarters ? ' lc-ask--starters' : ''}`}
      data-no-pan="true"
    >
      <div className="lc-ask-shell">
        <svg className="lc-ask-icon" width={13} height={13} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx={6.5} cy={6.5} r={5} stroke="currentColor" strokeWidth={1.5} fill="none" />
          <line x1={10.5} y1={10.5} x2={14} y2={14} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        <textarea
          ref={areaRef}
          className="lc-ask-field"
          data-demo-target="ask-input"
          placeholder="Explore Project Cosmos"
          rows={1}
          value={question}
          readOnly={isDemoQuestion}
          spellCheck={false}
          onFocus={() => {
            setExpanded(true);
            if (!isDemoQuestion) setQuestion('');
          }}
          onBlur={() => setExpanded(false)}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="lc-ask-bot" role="img" aria-label={statusLabel} title={statusLabel}>
          <span aria-hidden="true">🤖</span>
          <span
            className={`lc-status-dot lc-status-dot--${DOT_MODIFIER[aiStatus]}`}
            data-testid="ai-status-dot"
            aria-hidden="true"
          />
        </span>
        {showStarters && (
          <div className="lc-ask-starters" role="group" aria-label="Example questions">
            {STARTER_QUESTIONS.map((starter) => (
              <button
                key={starter}
                type="button"
                className="lc-ask-starter"
                onMouseDown={(e) => {
                  e.preventDefault();
                  askStarter(starter);
                }}
              >
                {starter}
              </button>
            ))}
          </div>
        )}
        {expanded && (
          <div className="lc-ask-footer">
            {aiStatus === 'disconnected' && (
              <button
                type="button"
                className="lc-ask-go"
                data-demo-target="connect-open"
                onMouseDown={(e) => {
                  e.preventDefault();
                  areaRef.current?.blur();
                  onConnectRequest();
                }}
                title="Connect an AI agent for real answers"
              >
                Connect AI Agent
              </button>
            )}
            {aiStatus === 'connected' && (
              <button
                type="button"
                className="lc-ask-go"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onDisconnect();
                }}
                title="Disconnect the AI agent and forget its key"
              >
                Disconnect AI Agent
              </button>
            )}
            <button
              type="button"
              className={`lc-ask-go${demoSearchPressed ? ' lc-ask-go--pressed' : ''}`}
              data-demo-target="ask-search"
              // mousedown fires before the textarea's blur, so preventing default
              // keeps focus and lets submit() drive the collapse itself.
              onMouseDown={(e) => {
                e.preventDefault();
                submit();
              }}
              title="Search"
            >
              Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
