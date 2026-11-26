'use client';

import { ReactNode, useState } from 'react';
import EmberPixels from '@/components/EmberPixels';

// Like the aurora intro: the fade-in plays once per visit, not on every
// navigation back to the page.
let glowPlayed = false;

/**
 * The standout word of a headline: ember gradient text with a soft glow that
 * fades in, and slow ember pixels rising off it (paused when off screen).
 */
const GlowWord = ({ children }: { children: ReactNode }) => {
  const [animate] = useState(() => {
    const play = !glowPlayed;
    glowPlayed = true;
    return play;
  });

  return (
    <span className="relative inline-block">
      <EmberPixels
        count={18}
        className="-inset-x-3 -top-7 bottom-2"
        drift={[-40, -10]}
        sway={[-10, 10]}
        sizes={[3, 4, 4, 6]}
        duration={[6, 11]}
      />
      <span
        className={`relative inline-block bg-gradient-to-r from-[#9a3412] via-[#f97316] to-[#f59e0b] bg-clip-text pb-[0.08em] text-transparent [-webkit-text-stroke:0.012em_rgba(234,88,12,0.5)] [filter:drop-shadow(0_0_22px_rgba(249,115,22,0.35))] ${
          animate ? 'animate-glow-in' : ''
        }`}
      >
        {children}
      </span>
    </span>
  );
};

export default GlowWord;
