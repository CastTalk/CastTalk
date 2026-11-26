'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// 3x3 grid cell indexes:  0 1 2 / 3 4 5 / 6 7 8
const FRAMES: number[][] = [
  // Grows and shrinks like Claude's spinner (· ✢ ✳ ✻ ✳ ✢), in pixels
  [4], //                        ·  dot
  [1, 3, 4, 5, 7], //            ✢  plus
  [0, 2, 4, 6, 8], //            ✳  x
  [0, 1, 2, 3, 4, 5, 6, 7, 8], // ✻  full spark
  [0, 2, 4, 6, 8], //            ✳  x
  [1, 3, 4, 5, 7], //            ✢  plus
];

// Warm-to-deep across the grid so each shape reads as an ember
const CELL_COLORS = ['#fde68a', '#fdba74', '#fb923c', '#fdba74', '#f97316', '#ea580c', '#fb923c', '#ea580c', '#9a3412'];

/**
 * CastTalk's thinking indicator: a tiny 3x3 pixel glyph that keeps changing shape
 * (dot -> plus -> x -> spark and back), like Claude's spinner.
 * Each pixel eases its opacity/scale/colour, so frames flow into each other
 * instead of snapping. `animate={false}` renders a static mark (e.g. avatar).
 */
const PixelLoader = ({ cell = 5, gap = 1.5, animate = true, className }: { cell?: number; gap?: number; animate?: boolean; className?: string }) => {
  const [frame, setFrame] = useState(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 190);
    return () => window.clearInterval(id);
  }, [animate]);

  const on = new Set(FRAMES[frame]);

  return (
    <span
      role={animate ? 'status' : undefined}
      aria-label={animate ? 'Thinking' : undefined}
      aria-hidden={animate ? undefined : true}
      className={cn('inline-grid grid-cols-3', className)}
      style={{ gap }}
    >
      {CELL_COLORS.map((color, i) => (
        <span
          key={i}
          style={{
            width: cell,
            height: cell,
            background: color,
            opacity: on.has(i) ? 1 : 0,
            transform: on.has(i) ? 'scale(1)' : 'scale(0.55)',
            transition: 'opacity 170ms ease-out, transform 170ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      ))}
    </span>
  );
};

export default PixelLoader;
