import { useEffect, useMemo, useRef, useState } from 'react';
import type { AskStreamEvent } from './askStream';
import type { DemoScriptedAnswer } from '../demo/types';
import { DISCONNECTING_ERROR_CODES, formatUsage, splitEmphasis, streamAskAnswer, toAskErrorMessage } from './askStream';

interface AskPanelProps {
  question: string;
  /** Buried under another surface on a phone — stays mounted so the answer keeps streaming. */
  hidden?: boolean;
  onClose: () => void;
  /** Fired once when the "thinking" phase ends and the answer starts typing. */
  onAnswerStart?: () => void;
  /** True while no AI agent is connected — the canned joke then ends with a Connect prompt. */
  showConnectPrompt?: boolean;
  onConnectRequest?: () => void;
  /** Read once at mount: connected streams a real answer, otherwise the canned joke plays. */
  isAiConnected?: boolean;
  /** Map actions the live agent streams alongside its answer. */
  onAction?: (action: AskAction) => void;
  /** The server rejected the stored key mid-answer; the caller clears it so the light turns red. */
  onKeyRejected?: () => void;
  /** Demo mode: plays this fixed answer instead of streaming or the joke; `actions` fire as it starts. */
  scriptedAnswer?: DemoScriptedAnswer;
}

export type AskAction =
  | { type: 'action'; kind: 'highlight'; serviceIds: string[] }
  | { type: 'action'; kind: 'playScenario'; scenarioId: string };

// Same running joke, ten ways: this is a portfolio demo with no live model
// wired up, so every "answer" is a self-aware placeholder.
const DEMO_ANSWERS = [
  "Hi — I'm just a demo for questioning an AI agent about this system. I don't have money for real tokens right now, since I'm currently looking for a job. 🚀",
  "Great question! Sadly I'm a cardboard cutout of an AI — no live model behind me yet. The real tokens cost real money, and I'm between jobs. Hire the author and I'll wake up. 😅",
  "I'd love to answer that properly, but I'm running on vibes and zero API credits. Turns out inference isn't free, and neither is rent. Job offers welcome. 💸",
  "Beep boop — pretend I said something brilliant about the architecture here. In reality I'm a demo with an empty wallet, waiting for a paycheck to afford tokens. 🤖",
  "Honestly? I'm all UI and no brain at the moment. Wiring me to a real model needs budget, and the budget needs a job. Consider this my very polite CV. 📄",
  "You've reached the AI agent's answering machine. It's not home — it couldn't pay the token bill. Leave a job offer after the tone. Beeeep. ☎️",
  "If I were a real agent I'd trace your question across every service on this map. But I'm a broke demo, so instead I'll just charmingly gesture at the stars. ✨",
  "Plot twist: there's no model here, just an unemployed developer's sense of humor. The tokens are imaginary; the job search is very real. 🙃",
  "I asked myself your question and I, too, have no idea — I'm a placeholder with big dreams and no compute budget. Someday, with a salary, I'll actually think. 🌱",
  "Loading intelligence… failed: insufficient funds. I'm a demo agent surviving on free-tier optimism while my author hunts for a job. Thanks for playing along! 🎈",
];

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
 * Left-side answer panel mirroring the star inspector. Connected, it streams
 * the agent's NDJSON answer; otherwise it fakes an agent "thinking" for a
 * random 3–4s, then reveals a canned answer word by word.
 */
export function AskPanel({
  question,
  hidden = false,
  onClose,
  onAnswerStart,
  showConnectPrompt = false,
  onConnectRequest,
  isAiConnected = false,
  onAction,
  onKeyRejected,
  scriptedAnswer,
}: AskPanelProps) {
  const isScripted = scriptedAnswer !== undefined;
  const [isAiConnectedAtMount] = useState(isAiConnected);
  const isLive = isAiConnectedAtMount && !isScripted;
  const jokeAnswer = useMemo(() => DEMO_ANSWERS[Math.floor(Math.random() * DEMO_ANSWERS.length)], []);
  const answer = scriptedAnswer?.text ?? jokeAnswer;
  const words = useMemo(() => answer.split(' '), [answer]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [wordCount, setWordCount] = useState(0);
  const [liveAnswer, setLiveAnswer] = useState('');
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const callbacksRef = useRef({ onAnswerStart, onAction, onKeyRejected });
  useEffect(() => {
    callbacksRef.current = { onAnswerStart, onAction, onKeyRejected };
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
          if (DISCONNECTING_ERROR_CODES.has(event.errorCode)) callbacksRef.current.onKeyRejected?.();
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

  useEffect(() => {
    if (isLive || isScripted) return;
    const thinkMs = 3000 + Math.random() * 1000;
    const startTyping = window.setTimeout(() => {
      setPhase('typing');
      callbacksRef.current.onAnswerStart?.();
    }, thinkMs);
    timers.current.push(startTyping);
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [isLive, isScripted]);

  useEffect(() => {
    if (isLive || isScripted || phase !== 'typing') return;
    if (wordCount >= words.length) {
      setPhase('done');
      return;
    }
    const id = window.setTimeout(() => setWordCount((c) => c + 1), 55 + Math.random() * 70);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [isLive, isScripted, phase, wordCount, words.length]);

  const revealed = isLive ? liveAnswer : words.slice(0, wordCount).join(' ');

  return (
    <div className="lc-ask-panel" data-no-pan="true" hidden={hidden} onClick={(e) => e.stopPropagation()}>
      <button className="lc-map-panel-close lc-ask-panel-close" onClick={onClose} aria-label="Close">
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </button>

      <div className="lc-ask-panel-head">
        <span className="lc-map-panel-eyebrow">Explore Project Cosmos</span>
        <p className="lc-ask-panel-question">{question}</p>
      </div>

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
        {phase === 'done' && showConnectPrompt && !isScripted && onConnectRequest && (
          <button type="button" className="lc-ask-connect" onClick={onConnectRequest}>
            Connect an AI agent for real answers.
          </button>
        )}
      </div>
    </div>
  );
}
