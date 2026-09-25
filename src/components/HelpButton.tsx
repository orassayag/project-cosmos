/**
 * "?" pill that opens the help modal. The modal itself ({@link HelpModal}) is
 * rendered once at the app root, so it survives the mobile drawer that hosts
 * this button unmounting.
 */
export function HelpButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="lc-help-btn"
      onClick={onOpen}
      aria-label="What is this?"
    >
      ?
    </button>
  );
}
