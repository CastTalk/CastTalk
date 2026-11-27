'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * CastAI's mascot: an ember clay blob with two eye dashes. Original to CastTalk
 * (drawn here in code), in the spirit of the "clay bot" style.
 *
 * The body outline is a set of points around a centre, each with its own radius.
 * Changing shape eases every radius from the old shape to the new one, so it
 * morphs like a blob (circle -> triangle -> cloud) — even mid-thought — instead
 * of swapping. A slight wobble keeps it alive. Animation pauses when off screen,
 * in a hidden tab, or for prefers-reduced-motion.
 *
 * Moods:
 *  idle     circle, attentive eyes, breathing (standby)
 *  easy     circle, glancing around (simple chat)
 *  thinking triangle "philosopher", eyes up, thinking dots (deep search)
 *  hard     cloud, frowning brows (automation / multi-step)
 *  alert    exclamation (needs attention, e.g. sign-in required)
 *  burst    ember burst (a reply just landed), then settles
 *  sleep    eyes closed, z's (no activity for a while)
 */
export type MascotMood = 'idle' | 'easy' | 'thinking' | 'hard' | 'alert' | 'burst' | 'sleep';

type Shape = 'circle' | 'triangle' | 'cloud';

const SHAPE_FOR: Record<MascotMood, Shape> = {
  idle: 'circle',
  easy: 'circle',
  thinking: 'triangle',
  hard: 'cloud',
  alert: 'circle',
  burst: 'circle',
  sleep: 'circle',
};

const N = 72; // outline points
const TAU = Math.PI * 2;

// Radius (relative to 1) at angle a (0 = right, counter-clockwise, y up) for each shape
const radiusFns: Record<Shape, (a: number) => number> = {
  circle: () => 1,
  // Rounded triangle pointing up: regular-polygon radius softened toward a circle
  triangle: (a) => {
    const n = 3;
    const seg = TAU / n;
    const local = ((((a - Math.PI / 2) % seg) + seg) % seg) - seg / 2;
    const poly = Math.cos(Math.PI / n) / Math.cos(local);
    return 0.72 * poly + 0.28 * 1.02;
  },
  // Puffy cloud: rounded bumps, fuller on top, flatter base
  cloud: (a) => {
    const bumps = 0.13 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.6);
    const flatBase = Math.sin(a) < -0.55 ? -0.06 * (-Math.sin(a) - 0.55) / 0.45 : 0;
    return 0.95 + bumps + flatBase;
  },
};

const sampleShape = (shape: Shape) => Array.from({ length: N }, (_, i) => radiusFns[shape]((i / N) * TAU));

// Smooth closed path through points (Catmull-Rom -> cubic Bezier)
const toPath = (pts: [number, number][]) => {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Glance targets for "easy" (eyes look around)
const GLANCES: [number, number][] = [[0, 0], [5, -2], [-5, -1], [3, 3], [-4, 2], [0, -3]];

const CastAIMascot = ({
  mood = 'idle',
  size = 40,
  animate = true,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  /** false = static (e.g. message avatars): no animation loop */
  animate?: boolean;
  className?: string;
}) => {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const shape = SHAPE_FOR[mood];

  // Morph state lives in refs so the rAF loop never re-renders React
  const fromRef = useRef<number[]>(sampleShape(shape));
  const toRef = useRef<number[]>(sampleShape(shape));
  const currentRef = useRef<number[]>(sampleShape(shape));
  const startRef = useRef(0);
  const [glance, setGlance] = useState<[number, number]>([0, 0]);

  // New target shape: start from wherever the outline is right now (mid-morph is fine)
  useEffect(() => {
    fromRef.current = currentRef.current.slice();
    toRef.current = sampleShape(shape);
    startRef.current = performance.now();
  }, [shape]);

  // Outline loop: morph + gentle wobble + breathing. Paused when not visible.
  useEffect(() => {
    const draw = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / 650);
      const e = easeOutCubic(t);
      const wobbleAmp = animate ? (mood === 'hard' ? 0.022 : 0.012) : 0;
      const breathe = animate ? 1 + 0.018 * Math.sin(now / 900) : 1;
      const pts: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const r = fromRef.current[i] + (toRef.current[i] - fromRef.current[i]) * e;
        currentRef.current[i] = r;
        const w = wobbleAmp * Math.sin(now / 420 + a * 3) + wobbleAmp * 0.6 * Math.sin(now / 610 - a * 2);
        const rr = 30 * r * breathe * (1 + w);
        pts.push([50 + rr * Math.cos(a), 52 - rr * Math.sin(a) * (mood === 'sleep' ? 0.9 : 1)]);
      }
      pathRef.current?.setAttribute('d', toPath(pts));
    };

    if (!animate) {
      draw(startRef.current + 1000);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(performance.now() + 1000);
      return;
    }

    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    if (svgRef.current) io.observe(svgRef.current);
    document.addEventListener('visibilitychange', wake);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', wake);
    };
  }, [animate, mood]);

  // Eyes glance around in "easy" (and occasionally in idle)
  useEffect(() => {
    if (!animate || (mood !== 'easy' && mood !== 'idle')) {
      setGlance([0, 0]);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % GLANCES.length;
      setGlance(mood === 'easy' ? GLANCES[i] : i % 3 === 0 ? GLANCES[i] : [0, 0]);
    }, mood === 'easy' ? 900 : 2200);
    return () => window.clearInterval(id);
  }, [animate, mood]);

  const eyeTransition = { type: 'spring', stiffness: 260, damping: 22 } as const;
  const eyeY = mood === 'thinking' ? -6 : 0;
  const eyeX = mood === 'thinking' ? 5 : glance[0];

  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <svg ref={svgRef} viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
        <defs>
          {/* Clay shading: warm highlight top-left, deeper ember bottom-right */}
          <radialGradient id={`clay-${uid}`} cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="38%" stopColor="#fb923c" />
            <stop offset="78%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id={`shine-${uid}`} cx="30%" cy="22%" r="30%">
            <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#fff7ed" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft shadow */}
        <ellipse cx="50" cy="90" rx="22" ry="3.5" fill="#9a3412" opacity="0.08" />

        {/* Body */}
        <path ref={pathRef} fill={`url(#clay-${uid})`} />
        <ellipse cx="38" cy="34" rx="12" ry="8" fill={`url(#shine-${uid})`} />

        {/* Brows (hard: frowning) */}
        <AnimatePresence>
          {mood === 'hard' && (
            <motion.g key="brows" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}>
              <rect x="34" y="33" width="12" height="3" rx="1.5" fill="#1c1917" transform="rotate(16 40 34.5)" />
              <rect x="54" y="33" width="12" height="3" rx="1.5" fill="#1c1917" transform="rotate(-16 60 34.5)" />
            </motion.g>
          )}
        </AnimatePresence>

        {/* Eyes */}
        {mood === 'sleep' ? (
          <g>
            <rect x="36" y="50" width="10" height="3" rx="1.5" fill="#1c1917" />
            <rect x="54" y="50" width="10" height="3" rx="1.5" fill="#1c1917" />
          </g>
        ) : (
          <motion.g animate={{ x: eyeX, y: eyeY + glance[1] * (mood === 'easy' ? 1 : 0) }} transition={eyeTransition}>
            {mood === 'alert' ? (
              <>
                <motion.circle cx="42" cy="49" r="5.5" fill="#1c1917" initial={{ scale: 0.6 }} animate={{ scale: 1 }} />
                <motion.circle cx="58" cy="49" r="5.5" fill="#1c1917" initial={{ scale: 0.6 }} animate={{ scale: 1 }} />
              </>
            ) : (
              <>
                <motion.rect
                  x="38.5"
                  width="6.5"
                  rx="3.25"
                  fill="#1c1917"
                  initial={{ y: 40, height: 17 }}
                  animate={{ y: mood === 'hard' ? 43 : 40, height: mood === 'hard' ? 12 : 17 }}
                  transition={eyeTransition}
                />
                <motion.rect
                  x="55"
                  width="6.5"
                  rx="3.25"
                  fill="#1c1917"
                  initial={{ y: 40, height: 17 }}
                  animate={{ y: mood === 'hard' ? 43 : 40, height: mood === 'hard' ? 12 : 17 }}
                  transition={eyeTransition}
                />
              </>
            )}
          </motion.g>
        )}

        {/* Exclamation */}
        <AnimatePresence>
          {mood === 'alert' && (
            <motion.g key="bang" initial={{ opacity: 0, y: 6, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} style={{ originX: '86px', originY: '14px' }}>
              <rect x="83" y="2" width="6" height="15" rx="3" fill="#f97316" />
              <circle cx="86" cy="22" r="3.2" fill="#f97316" />
            </motion.g>
          )}
        </AnimatePresence>

        {/* Thinking dots */}
        <AnimatePresence>
          {mood === 'thinking' && (
            <motion.g key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={74 + i * 9}
                  cy={18}
                  r={i === 1 ? 4 : 3.2}
                  fill={i === 1 ? '#fb923c' : '#c2410c'}
                  animate={animate ? { y: [0, -4, 0], opacity: [0.5, 1, 0.5] } : undefined}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Sleep z's */}
        <AnimatePresence>
          {mood === 'sleep' && (
            <motion.g key="zz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1].map((i) => (
                <motion.text
                  key={i}
                  x={74 + i * 9}
                  y={26 - i * 10}
                  fontSize={i ? 11 : 9}
                  fontWeight={700}
                  fill="#c2410c"
                  className="font-pixel"
                  animate={animate ? { y: [26 - i * 10, 20 - i * 10], opacity: [0, 1, 0] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.1 }}
                >
                  z
                </motion.text>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Burst: ember sparks fly out once */}
        <AnimatePresence>
          {mood === 'burst' &&
            Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * TAU + 0.3;
              return (
                <motion.circle
                  key={`spark-${i}`}
                  r={i % 2 ? 2.4 : 3.2}
                  fill={i % 3 === 0 ? '#fde68a' : i % 3 === 1 ? '#fb923c' : '#c2410c'}
                  initial={{ cx: 50 + 30 * Math.cos(a), cy: 52 - 30 * Math.sin(a), opacity: 1, scale: 1 }}
                  animate={{ cx: 50 + 48 * Math.cos(a), cy: 52 - 48 * Math.sin(a), opacity: 0, scale: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              );
            })}
        </AnimatePresence>
      </svg>
    </span>
  );
};

export default CastAIMascot;
