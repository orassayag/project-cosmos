import { useCallback, useEffect, useRef, useState } from 'react';

interface AskAgentProps {
  onAsk: (question: string) => void;
  /** Bumped by the "Cosmos" reset / global Esc — clears the typed question. */
  resetNonce?: number;
}

/**
 * Topbar "Ask the agent" field. Collapsed it reads as a one-line input with
 * no button; focusing it grows the field into a card holding the textarea and
 * a Go button at the bottom. Blur or Go collapses it back, keeping the text;
 * refocusing, Esc, or a galaxy reset clears it for a fresh question.
 */
export function AskAgent({ onAsk, resetNonce = 0 }: AskAgentProps) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // A galaxy reset ("Cosmos" title / global Esc) wipes the field too.
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        setQuestion('');
        areaRef.current?.blur();
      }
    },
    [submit],
  );

  return (
    <div ref={rootRef} className={`lc-ask${expanded ? ' lc-ask--expanded' : ''}`} data-no-pan="true">
      <div className="lc-ask-shell">
        <svg className="lc-ask-icon" width={13} height={13} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx={6.5} cy={6.5} r={5} stroke="currentColor" strokeWidth={1.5} fill="none" />
          <line x1={10.5} y1={10.5} x2={14} y2={14} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        <textarea
          ref={areaRef}
          className="lc-ask-field"
          placeholder="Explore the cosmos"
          rows={1}
          value={question}
          spellCheck={false}
          onFocus={() => { setExpanded(true); setQuestion(''); }}
          onBlur={() => setExpanded(false)}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {expanded && (
          <div className="lc-ask-footer">
            <button
              type="button"
              className="lc-ask-go"
              // mousedown fires before the textarea's blur, so preventing default
              // keeps focus and lets submit() drive the collapse itself.
              onMouseDown={(e) => {
                e.preventDefault();
                submit();
              }}
              title="Ask the agent"
            >
              Go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
