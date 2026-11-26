'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Ember = {
  left: number; // %
  top: number; // %
  size: number; // px
  color: string;
  opacity: number;
  dx: number; // px, end offset
  dy: number; // px, end offset
  duration: number; // s
  delay: number; // s
};

const PALETTE = ['#9a3412', '#c2410c', '#f97316', '#fb923c', '#fdba74', '#fde68a'];
const GRID = 4; // px — sizes and drift snap to a 4px grid so motion reads as pixel art

interface EmberPixelsProps {
  /** Number of pixels on wide screens; scaled down on narrow ones */
  count: number;
  /** Positioning box (absolute) for the field */
  className?: string;
  /** Vertical drift range in px [min, max]; negative rises, positive sinks */
  drift?: [number, number];
  /** Horizontal drift range in px [min, max] */
  sway?: [number, number];
  /** Pixel sizes to pick from */
  sizes?: number[];
  /** Animation length range in seconds — long = slow embers */
  duration?: [number, number];
}

/**
 * Slow "embering" pixels: small ember-palette squares that fade in, drift a
 * little in stepped pixel moves, and fade out, on a loop.
 *
 * - Random positions every load (generated after mount, so SSR markup matches).
 * - Pauses (animation-play-state) whenever the field is off screen or the tab
 *   is hidden, and doesn't animate at all for prefers-reduced-motion.
 * - Pure CSS transforms/opacity: no JS per frame, cheap on low-end devices.
 */
const EmberPixels = ({
  count,
  className,
  drift = [-28, 20],
  sway = [-16, 16],
  sizes = [4, 4, 4, 6, 8],
  duration = [7, 13],
}: EmberPixelsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [embers, setEmbers] = useState<Ember[]>([]);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const snap = (v: number) => Math.round(v / GRID) * GRID;
    const n = window.innerWidth < 640 ? Math.round(count * 0.55) : count;
    setEmbers(
      Array.from({ length: n }, () => {
        const d = rand(duration[0], duration[1]);
        return {
          left: rand(0, 100),
          top: rand(0, 100),
          size: sizes[Math.floor(Math.random() * sizes.length)],
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          opacity: rand(0.45, 0.95),
          dx: snap(rand(sway[0], sway[1])),
          dy: snap(rand(drift[0], drift[1])),
          duration: d,
          delay: -rand(0, d), // start mid-cycle so the field is already alive
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause when off screen or when the tab is hidden
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = false;
    const update = () => setPaused(!onScreen || document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden data-paused={paused} className={cn('ember-field pointer-events-none absolute', className)}>
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember-px absolute"
          style={
            {
              left: `${e.left}%`,
              top: `${e.top}%`,
              width: e.size,
              height: e.size,
              background: e.color,
              '--o': e.opacity,
              '--dx': `${e.dx}px`,
              '--dy': `${e.dy}px`,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};

export default EmberPixels;
