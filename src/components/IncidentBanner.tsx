import { AnimatePresence, motion } from 'framer-motion';

import type { Incident } from '../scenarios/data';
import type { Step } from '../scenarios/types';

interface IncidentBannerProps {
  /** The active incident, or null when a normal scenario (or nothing) plays. */
  incident: Incident | null;
  /** The step currently in view — its narrative drives the panel body. */
  step: Step | null;
  /** Local index of the current step (-1 before playback starts). */
  stepIndex: number;
  /** Total steps in the incident, for the counter. */
  stepCount: number;
}

/**
 * The incident narration panel. Styled like the player-controls box (soft
 * radius, blur, backdrop) but held in incident red, so an incident replay can
 * never be mistaken for live traffic. The header carries the INCIDENT badge
 * beside the incident title; the body is the current step's narrative and
 * crossfades as playback advances; the source links sit along the bottom.
 */
export function IncidentBanner({ incident, step, stepIndex, stepCount }: IncidentBannerProps) {
  return (
    <AnimatePresence>
      {incident && (
        <motion.aside
          key={incident.id}
          className="lc-incident-panel"
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24, ease: [0.2, 0.9, 0.3, 1.1] }}
        >
          <header className="lc-incident-panel-head">
            <span className="lc-incident-panel-badge">INCIDENT</span>
            <h3 className="lc-incident-panel-title">{incident.label}</h3>
            {stepCount > 0 && stepIndex >= 0 && (
              <span className="lc-incident-panel-counter">{stepIndex + 1} / {stepCount}</span>
            )}
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={stepIndex}
              className="lc-incident-panel-body"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.2, 0.9, 0.3, 1.1] }}
            >
              {step ? step.plain : incident.note}
            </motion.p>
          </AnimatePresence>

          <footer className="lc-incident-panel-foot">
            <span className="lc-incident-panel-meta">
              Replaying from {incident.date}
              {incident.time ? ` · ${incident.time}` : ''}
            </span>
            {incident.refs && incident.refs.length > 0 && (
              <span className="lc-incident-panel-refs">
                {incident.refs.map((ref) => (
                  <a
                    key={ref.url}
                    className="lc-incident-panel-ref"
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ref.label}
                  </a>
                ))}
              </span>
            )}
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
