import type { ReactNode } from 'react';

interface MapStepperProps {
  /** Extra class for positioning the panel (e.g. lc-map-stepper--zoom). */
  className: string;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled?: boolean;
  decrementDisabled?: boolean;
  incrementAriaLabel: string;
  decrementAriaLabel: string;
  /** Value shown on the reset button (percentage, multiplier, …). */
  resetLabel: ReactNode;
  onReset: () => void;
  resetTitle?: string;
  resetAriaLabel: string;
}

/**
 * A vertical +/− panel with a value-bearing reset button at the bottom.
 * Shared by the zoom and traffic controls so the two stay pixel-identical.
 */
export function MapStepper({
  className,
  onIncrement,
  onDecrement,
  incrementDisabled,
  decrementDisabled,
  incrementAriaLabel,
  decrementAriaLabel,
  resetLabel,
  onReset,
  resetTitle,
  resetAriaLabel,
}: MapStepperProps) {
  return (
    <div className={`lc-map-stepper ${className}`} data-no-pan="true">
      <button
        type="button"
        className="lc-map-zoom-btn"
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label={incrementAriaLabel}
      >
        +
      </button>
      <button
        type="button"
        className="lc-map-zoom-btn"
        onClick={onDecrement}
        disabled={decrementDisabled}
        aria-label={decrementAriaLabel}
      >
        −
      </button>
      <button
        type="button"
        className="lc-map-zoom-btn lc-map-zoom-reset"
        onClick={onReset}
        title={resetTitle}
        aria-label={resetAriaLabel}
      >
        {resetLabel}
      </button>
    </div>
  );
}
