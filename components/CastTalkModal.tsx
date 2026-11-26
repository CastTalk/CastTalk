'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

interface CastTalkModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: string;
  /** Show the "esc" hint + close button in the corner (default true) */
  showClose?: boolean;
}

// Kole Jain's modal easing (easeOutCirc-like): quick start, long soft settle
const EASE = [0.075, 0.82, 0.165, 1] as const;

/**
 * Shared modal, styled after kolejain.com: a frosted #fafafa shell with a 4px
 * bezel around a hairline-bordered card, a light blurred backdrop (not a dark
 * dim), an "esc" hint, and a soft ember glow.
 *
 * - Rendered through a portal into <body>, so a transformed / overflow-hidden
 *   ancestor can never shrink the fixed backdrop (that left an uncovered strip
 *   at the bottom of the Schedule page).
 * - Animates in and out. Callers that mount it conditionally should wrap it in
 *   <AnimatePresence>; `propagate` lets that outer exit reach these motion nodes.
 *   Callers that keep it mounted just toggle `isOpen`.
 */
const CastTalkModal = ({
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-[495px]',
  showClose = true,
}: CastTalkModalProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc to close + lock page scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence propagate>
      {isOpen && (
        <div key="castalk-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          {/* Light frosted backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#f4f4f5]/55 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
          />

          {/* Shell (bezel) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.18, ease: 'easeIn' } }}
            transition={{ duration: 0.6, ease: EASE }}
            className={cn(
              'relative w-full rounded-[20px] bg-[#fafafa]/90 p-1 font-geist text-ink shadow-[0_40px_100px_-30px_rgba(154,52,18,0.4),0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-xl',
              maxWidth,
              className
            )}
          >
            {/* Card */}
            <div className="relative overflow-hidden rounded-2xl border-[0.8px] border-[#e0e0e0] bg-white">
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(249,115,22,0.14),rgba(253,230,138,0.12)_60%,transparent)] blur-2xl"
              />

              {showClose && (
                <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
                  <kbd className="hidden rounded-md border border-black/10 bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:inline">
                    esc
                  </kbd>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-black/5 hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className={cn('relative z-10 flex flex-1 flex-col px-6 pb-6', showClose ? 'pt-12' : 'pt-6', contentClassName)}>{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CastTalkModal;
