import { AnimatePresence, motion } from 'framer-motion';

import type { Scenario, Step } from '../api/cosmos-api';
import { nodeName, useCosmosIndex } from '../api/cosmosIndex';
import type { CosmosIndex } from '../api/cosmosIndex';
import { parsePayload } from './payload-parser';

interface StepPanelProps {
  scenario: Scenario | null;
  steps: Step[];
  idx: number;
  onPrev: () => void;
  onNext: () => void;
  /** Hides the panel entirely. Owned by the parent so it can be reset on new scenario / new step. */
  open: boolean;
  onClose: () => void;
}

const PROTO_LABEL = { http: 'HTTP', ws: 'WebSocket', kafka: 'Kafka', internal: 'Internal' } as const;

function stepPath(step: Step, index: CosmosIndex): string {
  const parts = [nodeName(index, step.from)];
  if (step.via) parts.push(nodeName(index, step.via));
  if (step.through) parts.push(nodeName(index, step.through));
  parts.push(nodeName(index, step.to));
  return parts.join(' → ');
}

/**
 * Step explainer panel — single mount per scenario. The OUTER aside
 * slides in/out only when `open` flips. Stepping next/prev keeps it
 * mounted; only the inner content crossfades. This keeps the panel
 * stable so the eye doesn't have to track a full re-entry every step.
 */
export function StepPanel({ scenario, steps, idx, open, onPrev, onNext, onClose }: StepPanelProps) {
  const index = useCosmosIndex();
  const step = idx >= 0 && idx < steps.length ? steps[idx] : null;
  const visible = open && !!scenario && !!step;
  const showPrev = idx > 0;
  const showNext = idx < steps.length - 1;
  const protoLabel = step ? PROTO_LABEL[step.type] : '';

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key="step-panel"
          className="lc-step-panel"
          data-no-pan="true"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.22, ease: [0.2, 0.9, 0.3, 1.1] }}
        >
          <button
            className="lc-step-panel-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <svg width={14} height={14} viewBox="0 0 14 14">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </button>

          {/* Stable header: scenario + step counter — never unmounts. */}
          <div className="lc-step-panel-eyebrow" style={{ color: scenario.color }}>
            STEP {String(idx + 1).padStart(2, '0')} · {scenario.label.toUpperCase()}
          </div>

          {/* Body content swaps on step change with a quick crossfade. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${scenario.id}-${idx}`}
              className="lc-step-panel-body"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.2, 0.9, 0.3, 1.1] }}
            >
              <h3 className="lc-step-panel-title">{step.title}</h3>
              <div className="lc-step-panel-sub">
                <span className={`lc-step-panel-proto p-${step.type}`}>{protoLabel}</span>
                <span className="lc-step-panel-path">{stepPath(step, index)}</span>
              </div>
              <p className="lc-step-panel-desc">{step.plain}</p>
              {step.payload && (
                <div className="lc-step-panel-payload">
                  <div className="lc-step-panel-sec-label">Message · Payload</div>
                  <div className="lc-payload-stream">
                    {parsePayload(step.payload).map((sec, i) => {
                      if (sec.kind === 'heading') {
                        return <div key={i} className="lc-payload-heading">{sec.content}</div>;
                      }
                      if (sec.kind === 'label') {
                        return <div key={i} className="lc-payload-label">{sec.content}</div>;
                      }
                      if (sec.kind === 'comment') {
                        return <div key={i} className="lc-payload-comment">{sec.content}</div>;
                      }
                      return <pre key={i} className="lc-payload-code">{sec.content}</pre>;
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="lc-step-panel-actions">
            {showPrev ? (
              <button type="button" className="lc-pb-pill lc-pb-pill--solo" onClick={onPrev}>← Prev</button>
            ) : <span />}
            <span className="lc-step-panel-counter">{idx + 1} / {steps.length}</span>
            {showNext ? (
              <button type="button" className="lc-pb-pill lc-pb-pill--solo" onClick={onNext}>Next →</button>
            ) : <span />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
