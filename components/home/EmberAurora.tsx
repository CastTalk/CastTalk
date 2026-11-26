'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

type AuroraProps = {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  height?: number;
  opacity?: number;
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

/**
 * A soft ember aurora behind the hero heading.
 * Light mode + low opacity so it blends into the white page and never fights
 * the text; the mask fades it out before the mockup.
 */
const EmberAurora = ({ className = '' }: { className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-x-0 top-0 h-[560px] ${className}`}
    style={{
      maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
    }}
  >
    <Aurora
      colorStops={['#9a3412', '#f97316', '#fde68a']}
      lightMode
      opacity={0.6}
      blend={0.65}
      amplitude={0.9}
      height={0.5}
      speed={0.6}
      mouseInteraction={false}
    />
  </div>
);

export default EmberAurora;
