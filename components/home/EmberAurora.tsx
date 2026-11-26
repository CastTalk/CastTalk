'use client';

import dynamic from 'next/dynamic';
import { useState, type ComponentType } from 'react';

type AuroraProps = {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  height?: number;
  scale?: number;
  glow?: number;
  layers?: number;
  opacity?: number;
  intro?: boolean;
  lightMode?: boolean;
  mouseInteraction?: boolean;
  paused?: boolean;
  className?: string;
};

// WebGL — client only. Aurora.jsx is untyped JS from React Bits.
const Aurora = dynamic(
  () => import('@/components/Aurora').then((m) => m.default as unknown as ComponentType<AuroraProps>),
  { ssr: false }
);

// The "rise in" intro plays once per visit. Every page that shows the aurora
// mounts a new instance, so without this the intro replayed on each navigation.
let introPlayed = false;

/**
 * A soft ember aurora behind the hero heading.
 * Light mode + reduced opacity so it blends into the white page. Long, tall
 * waves (high amplitude, low scale) at normal speed, drifting toward the cursor
 * like the React Bits demo; the mask fades it out before the content below.
 */
const EmberAurora = ({ className = '' }: { className?: string }) => {
  const [intro] = useState(() => {
    const play = !introPlayed;
    introPlayed = true;
    return play;
  });

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-[600px] ${className}`}
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
      }}
    >
      <Aurora
        colorStops={['#9a3412', '#f97316', '#fde68a']}
        lightMode
        intro={intro}
        opacity={0.6}
        blend={0.65}
        amplitude={1.6}
        scale={0.7}
        height={0.55}
        layers={2}
        speed={1}
        mouseInteraction
      />
    </div>
  );
};

export default EmberAurora;
