interface PanelCloseButtonProps {
  onClose: () => void;
  /** Accessible label — name the panel being closed, e.g. "Close ownership". */
  label?: string;
}

/**
 * The one corner "×" every floating panel gets on mobile.
 *
 * MOBILE-ONLY CONTRACT: every modal / popup / panel must render a close
 * control in its top-right corner. Panels with their own header close button
 * (inspector, step panel, help, changelog, …) already satisfy it; panels that
 * are otherwise dismissed off-canvas (the map legends, the incident banner)
 * drop this in. It's styled by `.lc-panel-x` in responsive.css, which hides it
 * on desktop and shows it on phone-class viewports — so any FUTURE panel gets
 * the required mobile close affordance simply by rendering this component.
 */
export function PanelCloseButton({ onClose, label = 'Close' }: PanelCloseButtonProps) {
  return (
    <button
      type="button"
      className="lc-panel-x"
      data-no-pan="true"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
    </button>
  );
}
