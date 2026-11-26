'use client';

import { useEffect, useState } from 'react';

type Pixel = { left: number; top: number; size: number; color: string; opacity: number; twinkle: boolean; delay: number };

const COLORS = ['#9a3412', '#f97316', '#fb923c', '#fdba74', '#fde68a'];
const GRID = 4; // px — every pixel snaps to a 4px grid so clusters read as pixel art

/**
 * Pixels "spreading" from a border line: a few random clusters of small
 * ember-palette squares along the bottom edge of the parent (which must be
 * `relative`). Sparse on purpose — roughly 10–20% of the line — and
 * regenerated on every load, so they never sit in a fixed place.
 *
 * Generated after mount (not during SSR) so server and client markup match.
 */
const PixelBorder = () => {
  const [pixels, setPixels] = useState<Pixel[]>([]);

  useEffect(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const clusters = Math.round(rand(2, 4));
    const next: Pixel[] = [];
    for (let c = 0; c < clusters; c++) {
      const center = rand(4, 96); // % along the line
      const spread = rand(1.5, 4); // % either side
      const count = Math.round(rand(5, 9));
      for (let i = 0; i < count; i++) {
        // denser near the cluster center, looser at its edges
        const offset = (Math.random() - 0.5) * 2 * spread * Math.sqrt(Math.random());
        const size = [4, 4, 4, 6, 8][Math.floor(Math.random() * 5)];
        next.push({
          left: Math.min(99.5, Math.max(0, center + offset)),
          top: Math.round(rand(-12, 8) / GRID) * GRID, // mostly on/under the line
          size,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: rand(0.45, 1),
          twinkle: Math.random() < 0.35,
          delay: rand(0, 4),
        });
      }
    }
    setPixels(next);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0">
      {pixels.map((p, i) => (
        <span
          key={i}
          className={p.twinkle ? 'absolute animate-pixel-twinkle' : 'absolute'}
          style={{
            left: `${p.left}%`,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default PixelBorder;
