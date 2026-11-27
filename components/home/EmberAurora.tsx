'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ComponentType } from 'react';

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
  dpr?: number;
  className?: string;
};

// WebGL — client only. Aurora.jsx is untyped JS from React Bits.
const Aurora = dynamic(
  () => import('@/components/Aurora').then((m) => m.default as unknown as ComponentType<AuroraProps>),
  { ssr: false }
);

// Rough device tier: low memory / few cores / data saver -> render lighter.
const isLowPowerDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4 || !!nav.connection?.saveData;
};

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
  // Low-power devices: 1x resolution and a single layer. Others: 2 layers, up to 2x.
  // (Aurora itself stops drawing when off screen or when the tab is hidden.)
  const [lowPower] = useState(isLowPowerDevice);
  // Start the WebGL aurora once the browser is idle after first paint, so it never
  // competes with the headline (LCP) or hydration for the main thread.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-[520px] ${className}`}
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
      }}
    >
      {ready && (
      <Aurora
        colorStops={['#9a3412', '#f97316', '#fde68a']}
        lightMode
        intro={intro}
        opacity={0.6}
        blend={0.65}
        amplitude={2.1}
        scale={0.65}
        height={0.42}
        layers={lowPower ? 1 : 2}
        // Soft gradient: rendering below device resolution and scaling up looks the
        // same and shades 3-7x fewer pixels per frame
        dpr={lowPower ? 0.5 : 0.75}
        speed={1}
        mouseInteraction
      />
      )}
    </div>
  );
};

export default EmberAurora;
