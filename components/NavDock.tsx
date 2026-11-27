'use client';

import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Brain, CalendarCheck, House } from '@/components/icons';
import { cn } from '@/lib/utils';

export const NAV_LINKS = [
  { label: 'Home', route: '/', icon: House },
  { label: 'Schedule', route: '/upcoming', icon: CalendarCheck },
  { label: 'CastAI', route: '/cast-ai', icon: Brain },
] as const;

const isActiveRoute = (pathname: string, route: string) => (route === '/' ? pathname === '/' : pathname.startsWith(route));

/**
 * Square dock navigation: one rounded-square bar, hairline dividers between
 * items, the current page shown as a dark pill with its icon + label, the others
 * as icon-only squares (label on hover). The active pill slides between items.
 */
const NavDock = ({
  pathname,
  onNavigate,
  className,
  layoutId = 'nav-dock-active',
  compact = false,
}: {
  pathname: string;
  onNavigate: (route: string) => void;
  className?: string;
  layoutId?: string;
  /** Header-height version (36px items) */
  compact?: boolean;
}) => (
  <nav
    aria-label="Main"
    className={cn(
      'flex items-center gap-1 border border-black/[0.07] bg-white/90 backdrop-blur-md',
      compact ? 'rounded-xl p-1 shadow-[0_4px_14px_-8px_rgba(154,52,18,0.3)]' : 'rounded-2xl p-1.5 shadow-[0_10px_30px_-14px_rgba(154,52,18,0.35)]',
      className
    )}
  >
    {NAV_LINKS.map((link, i) => {
      const active = isActiveRoute(pathname, link.route);
      const Icon = link.icon;
      return (
        <Fragment key={link.route}>
          {i > 0 && <span aria-hidden className={cn('w-px shrink-0 bg-black/[0.08]', compact ? 'h-5' : 'h-6')} />}
          <button
            onClick={() => onNavigate(link.route)}
            aria-current={active ? 'page' : undefined}
            aria-label={link.label}
            title={active ? undefined : link.label}
            className={cn(
              'relative flex items-center justify-center transition-colors',
              compact ? 'h-8 rounded-lg' : 'h-10 rounded-xl',
              // Active page: icon + label in the dark pill. Others: icon-only squares.
              active ? 'gap-2 px-3.5 text-white' : cn(compact ? 'w-8' : 'w-10', 'text-ink-soft hover:bg-ember/[0.07] hover:text-ink')
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={cn('absolute inset-0 bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]', compact ? 'rounded-lg' : 'rounded-xl')}
              />
            )}
            <Icon size={compact ? 18 : 20} className={cn('relative z-10', active ? 'text-[#fdba74]' : '')} />
            {active && <span className={cn('relative z-10 font-pixel leading-none', compact ? 'text-[12px]' : 'text-[13px]')}>{link.label}</span>}
          </button>
        </Fragment>
      );
    })}
  </nav>
);

export default NavDock;
