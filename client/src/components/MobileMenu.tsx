import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Slide-over drawer that holds the topbar's secondary chrome (domain +
 * incident pickers, ask, changelog, present, help) on phone-class viewports,
 * where they can't all fit in a single header row. Portalled to <body> so it
 * escapes the topbar's stacking context and covers the full stage.
 */
export function MobileMenu({ open, onClose, children }: MobileMenuProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="lc-mobile-menu-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.nav
            className="lc-mobile-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Menu"
          >
            <div className="lc-mobile-menu-head">
              <span className="lc-mobile-menu-title">Menu</span>
              <button
                type="button"
                className="lc-mobile-menu-close"
                data-demo-target="menu-close"
                onClick={onClose}
                aria-label="Close menu"
              >
                <svg width={16} height={16} viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="lc-mobile-menu-body">{children}</div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
