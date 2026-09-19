import { useEffect, useMemo, useRef, useState } from 'react';

interface AskPanelProps {
  question: string;
  onClose: () => void;
  /** Fired once when the "thinking" phase ends and the answer starts typing. */
  onAnswerStart?: () => void;
}

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

/**
 * Left-side answer panel mirroring the star inspector. Fakes an agent
 * "thinking" for a random 3–4s, then reveals a canned answer word by word
 * the way a chat UI streams tokens.
 */
export function AskPanel({ question, onClose, onAnswerStart }: AskPanelProps) {
  const answer = useMemo(() => DEMO_ANSWERS[Math.floor(Math.random() * DEMO_ANSWERS.length)], []);
  const words = useMemo(() => answer.split(' '), [answer]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [wordCount, setWordCount] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const thinkMs = 3000 + Math.random() * 1000;
    const startTyping = window.setTimeout(() => {
      setPhase('typing');
      onAnswerStart?.();
    }, thinkMs);
    timers.current.push(startTyping);
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    if (phase !== 'typing') return;
    if (wordCount >= words.length) {
      setPhase('done');
      return;
    }
    const id = window.setTimeout(() => setWordCount((c) => c + 1), 55 + Math.random() * 70);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [phase, wordCount, words.length]);

  const revealed = words.slice(0, wordCount).join(' ');

  return (
    <div className="lc-ask-panel" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <button className="lc-map-panel-close lc-ask-panel-close" onClick={onClose} aria-label="Close">
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </button>

      <div className="lc-ask-panel-head">
        <span className="lc-map-panel-eyebrow">Explore the Cosmos</span>
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
          <p className="lc-ask-answer">
            {revealed}
            {phase === 'typing' && <span className="lc-ask-caret" aria-hidden="true" />}
          </p>
        )}
      </div>
    </div>
  );
}
