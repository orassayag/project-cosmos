import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AskStreamEvent } from './askStream';
import type { DemoScriptedAnswer } from '../demo/types';
import { formatUsage, splitEmphasis, streamAskAnswer, toAskErrorMessage } from './askStream';

interface AskPanelProps {
  /** Empty when opened from the bot before anything is asked: only the question box shows. */
  question: string;
  onAsk: (question: string) => void;
  /** Buried under another surface on a phone — stays mounted so the answer keeps streaming. */
  hidden?: boolean;
  onClose: () => void;
  /** Fired once when the "thinking" phase ends and the answer starts typing. */
  onAnswerStart?: () => void;
  /** Map actions the live agent streams alongside its answer. */
  onAction?: (action: AskAction) => void;
  /** Demo mode: plays this fixed answer instead of streaming; `actions` fire as it starts. */
  scriptedAnswer?: DemoScriptedAnswer;
}

export type AskAction =
  | { type: 'action'; kind: 'highlight'; serviceIds: string[] }
  | { type: 'action'; kind: 'playScenario'; scenarioId: string }
  | { type: 'action'; kind: 'showBlastRadius'; nodeId: string }
  | { type: 'action'; kind: 'openPassport'; nodeId: string }
  | { type: 'action'; kind: 'showHealth' }
  | { type: 'action'; kind: 'showOwnership' }
  | { type: 'action'; kind: 'openChangelogEntry'; entryId: string };

type Phase = 'loading' | 'typing' | 'done';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
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

/**
 * Left-side answer panel mirroring the star inspector: it streams the agent's
 * NDJSON answer (or plays the demo's scripted one) and holds the question box.
 */
export function AskPanel({
  question,
  onAsk,
  hidden = false,
  onClose,
  onAnswerStart,
  onAction,
  scriptedAnswer,
}: AskPanelProps) {
  const isScripted = scriptedAnswer !== undefined;
  const hasQuestion = question !== '';
  const isLive = hasQuestion && !isScripted;

  const [phase, setPhase] = useState<Phase>('loading');
  const [wordCount, setWordCount] = useState(0);
  const [liveAnswer, setLiveAnswer] = useState('');
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const callbacksRef = useRef({ onAnswerStart, onAction });
  useEffect(() => {
    callbacksRef.current = { onAnswerStart, onAction };
  });

  useEffect(() => {
    if (!isLive) return;
    const controller = new AbortController();
    let hasStartedAnswer = false;
    const handleEvent = (event: AskStreamEvent) => {
      switch (event.type) {
        case 'token':
          if (!hasStartedAnswer) {
            hasStartedAnswer = true;
            setPhase('typing');
            callbacksRef.current.onAnswerStart?.();
          }
          setLiveAnswer((previous) => previous + event.text);
          break;
        case 'action':
          callbacksRef.current.onAction?.(event);
          break;
        case 'usage':
          setUsage({ inputTokens: event.inputTokens, outputTokens: event.outputTokens });
          break;
        case 'error':
          setErrorMessage(toAskErrorMessage(event.errorCode));
          break;
        case 'done':
          setPhase('done');
          break;
      }
    };
    void streamAskAnswer(question, controller.signal, handleEvent);
    return () => controller.abort();
  }, [isLive, question]);

  useEffect(() => {
    if (!scriptedAnswer) return;
    const { thinkingMs, wordMs, actions = [] } = scriptedAnswer;
    const wordTotal = scriptedAnswer.text.split(' ').length;
    setPhase('loading');
    setWordCount(0);
    const timeoutIds = [
      window.setTimeout(() => {
        setPhase('typing');
        callbacksRef.current.onAnswerStart?.();
        actions.forEach((action) => callbacksRef.current.onAction?.(action));
      }, thinkingMs),
    ];
    for (let wordIndex = 1; wordIndex <= wordTotal; wordIndex += 1) {
      timeoutIds.push(window.setTimeout(() => setWordCount(wordIndex), thinkingMs + wordIndex * wordMs));
    }
    timeoutIds.push(window.setTimeout(() => setPhase('done'), thinkingMs + wordTotal * wordMs));
    return () => timeoutIds.forEach((id) => window.clearTimeout(id));
  }, [scriptedAnswer]);

  const submit = useCallback(() => {
    const trimmedDraft = draft.trim();
    if (trimmedDraft !== '') onAsk(trimmedDraft);
  }, [draft, onAsk]);

  const onComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const revealed = isScripted ? scriptedAnswer.text.split(' ').slice(0, wordCount).join(' ') : liveAnswer;

  return (
    <div className="lc-ask-panel" data-no-pan="true" hidden={hidden} onClick={(e) => e.stopPropagation()}>
      <button className="lc-map-panel-close lc-ask-panel-close" onClick={onClose} aria-label="Close">
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </button>

      <div className="lc-ask-panel-head">
        <span className="lc-map-panel-eyebrow">Ask the agent</span>
        {hasQuestion && <p className="lc-ask-panel-question">{question}</p>}
      </div>

      {hasQuestion && (
        <div className="lc-ask-panel-body">
          {phase === 'loading' ? (
            <div className="lc-ask-thinking" aria-label="Thinking">
              <span className="lc-ask-dot" />
              <span className="lc-ask-dot" />
              <span className="lc-ask-dot" />
            </div>
          ) : (
            (revealed !== '' || phase === 'typing') && (
              <p className="lc-ask-answer">
                <EmphasizedText text={revealed} />
                {phase === 'typing' && <span className="lc-ask-caret" aria-hidden="true" />}
              </p>
            )
          )}
          {errorMessage !== null && (
            <p className="lc-ask-error" role="alert">
              {errorMessage}
            </p>
          )}
          {phase === 'done' && usage !== null && errorMessage === null && (
            <p className="lc-ask-usage">{formatUsage(usage.inputTokens, usage.outputTokens)}</p>
          )}
        </div>
      )}

      <div className="lc-ask-composer">
        <textarea
          className="lc-ask-composer-field"
          data-demo-target="ask-input"
          aria-label="Your question"
          placeholder="Ask about the map"
          rows={2}
          spellCheck={false}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        <button type="button" className="lc-ask-go" data-demo-target="ask-search" onClick={submit}>
          Search
        </button>
      </div>
    </div>
  );
}
