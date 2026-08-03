'use client';

/**
 * The hero's signature: a living network. Student "people" nodes sit on a faint
 * wireframe globe and connect by arcing hairlines to one central instructor
 * node; near-black pulses travel the lines (a buzz firing across the room).
 * Fully monochrome. Pure inline SVG, transparent — reads as placed on the hero.
 * Entrance + node motion via `motion`; the traveling pulses via SVG animateMotion.
 */

import { motion, useReducedMotion } from 'motion/react';

const CX = 250;
const CY = 250;
const R = 168; // globe radius

const EASE = [0.16, 1, 0.3, 1] as const;

type Seed = { a: number; d: number; r: number; outbound?: boolean };

// Angle (deg) / distance from center / node radius. Hand-placed for balance.
const SEEDS: Seed[] = [
  { a: -90, d: 150, r: 16 },
  { a: -40, d: 178, r: 20 },
  { a: 6, d: 150, r: 14, outbound: true },
  { a: 46, d: 172, r: 17 },
  { a: 92, d: 150, r: 21 },
  { a: 138, d: 176, r: 15, outbound: true },
  { a: 176, d: 150, r: 18 },
  { a: -140, d: 174, r: 16 },
  { a: -108, d: 116, r: 13, outbound: true },
];

// Round every derived coordinate: Math.cos/sin are not bit-identical between
// the Node server and the browser, which would trip React hydration.
const r2 = (v: number) => Math.round(v * 100) / 100;

const NODES = SEEDS.map((s, i) => {
  const rad = (s.a * Math.PI) / 180;
  const x = r2(CX + s.d * Math.cos(rad));
  const y = r2(CY + s.d * Math.sin(rad));
  // Perpendicular-offset control point for an arced connection.
  const dx = CX - x;
  const dy = CY - y;
  const len = Math.hypot(dx, dy);
  const sign = i % 2 === 0 ? 1 : -1;
  const k = 0.18 * sign;
  const mx = r2((x + CX) / 2 + (-dy / len) * len * k);
  const my = r2((y + CY) / 2 + (dx / len) * len * k);
  return {
    i,
    x,
    y,
    r: s.r,
    outbound: Boolean(s.outbound),
    path: `M ${x} ${y} Q ${mx} ${my} ${CX} ${CY}`,
    floatDur: 4.5 + (i % 4) * 0.8,
    floatDelay: (i % 5) * 0.4,
    pulseDur: 2.4 + (i % 3) * 0.5,
    pulseBegin: 1.5 + i * 0.28,
  };
});

/** A minimal person mark (head + shoulders) sized to a node radius, clipped. */
function Person({
  cx,
  cy,
  r,
  fill,
  clip,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  clip: string;
}) {
  const q = (v: number) => Math.round(v * 100) / 100;
  return (
    <g clipPath={`url(#${clip})`}>
      <circle cx={cx} cy={q(cy - r * 0.18)} r={q(r * 0.34)} fill={fill} />
      <ellipse cx={cx} cy={q(cy + r * 0.62)} rx={q(r * 0.66)} ry={q(r * 0.56)} fill={fill} />
    </g>
  );
}

export function HeroNetwork({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      role="img"
      aria-label="A live class network: students around the world connected to one instructor."
      fill="none"
    >
      <defs>
        <clipPath id="clip-instructor">
          <circle cx={CX} cy={CY} r={34} />
        </clipPath>
        {NODES.map((n) => (
          <clipPath id={`clip-${n.i}`} key={n.i}>
            <circle cx={n.x} cy={n.y} r={n.r} />
          </clipPath>
        ))}
      </defs>

      {/* ---- wireframe globe ---- */}
      <motion.g
        stroke="#0a0a0a"
        strokeOpacity={0.13}
        strokeWidth={1}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        <circle cx={CX} cy={CY} r={R} />
        {/* latitudes */}
        {[-104, -54, 0, 54, 104].map((oy) => {
          const rx = Math.sqrt(Math.max(R * R - oy * oy, 0));
          return (
            <ellipse
              key={oy}
              cx={CX}
              cy={CY + oy}
              rx={rx}
              ry={rx * 0.17}
            />
          );
        })}
        {/* longitudes — the two inner ones "breathe" to suggest rotation */}
        <ellipse cx={CX} cy={CY} rx={R} ry={R} />
        <motion.ellipse
          cx={CX}
          cy={CY}
          ry={R}
          initial={{ rx: R * 0.62 }}
          animate={reduce ? { rx: R * 0.62 } : { rx: [R * 0.62, R * 0.2, R * 0.62] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.ellipse
          cx={CX}
          cy={CY}
          ry={R}
          initial={{ rx: R * 0.3 }}
          animate={reduce ? { rx: R * 0.3 } : { rx: [R * 0.3, R * 0.9, R * 0.3] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
      </motion.g>

      {/* ---- connections ---- */}
      {NODES.map((n) => (
        <motion.path
          key={`c-${n.i}`}
          d={n.path}
          stroke="#0a0a0a"
          strokeOpacity={0.16}
          strokeWidth={1.2}
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 + n.i * 0.07, ease: EASE }}
        />
      ))}
      {/* hidden geometry copies for the pulses to follow */}
      {NODES.map((n) => (
        <path key={`p-${n.i}`} id={`conn-${n.i}`} d={n.path} fill="none" />
      ))}

      {/* ---- traveling signal pulses ---- */}
      {!reduce &&
        NODES.map((n) => (
          <g key={`s-${n.i}`}>
            <circle r={8} fill="#0a0a0a" opacity={0.14} />
            <circle r={3.4} fill="#0a0a0a" />
            <animateMotion
              dur={`${n.pulseDur}s`}
              begin={`${n.pulseBegin}s`}
              repeatCount="indefinite"
              calcMode="linear"
              keyPoints={n.outbound ? '1;0' : '0;1'}
              keyTimes="0;1"
            >
              <mpath href={`#conn-${n.i}`} />
            </animateMotion>
          </g>
        ))}

      {/* ---- student nodes ---- */}
      {NODES.map((n) => (
        <motion.g
          key={`n-${n.i}`}
          initial={reduce ? false : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.7 + n.i * 0.06,
            type: 'spring',
            stiffness: 220,
            damping: 15,
          }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <motion.g
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={{
              duration: n.floatDur,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: n.floatDelay,
            }}
          >
            {/* white cutout so the node punches cleanly through the lines */}
            <circle cx={n.x} cy={n.y} r={n.r + 3.5} fill="#ffffff" />
            <circle cx={n.x} cy={n.y} r={n.r} fill="#0a0a0a" />
            <Person cx={n.x} cy={n.y} r={n.r} fill="#ffffff" clip={`clip-${n.i}`} />
          </motion.g>
        </motion.g>
      ))}

      {/* ---- central instructor node ---- */}
      {!reduce && (
        <motion.circle
          cx={CX}
          cy={CY}
          r={34}
          stroke="#0a0a0a"
          strokeWidth={2}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      )}
      <motion.g
        initial={reduce ? false : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 16 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <circle cx={CX} cy={CY} r={40} fill="#ffffff" />
        <circle cx={CX} cy={CY} r={34} fill="#0a0a0a" />
        <circle
          cx={CX}
          cy={CY}
          r={34}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.5}
        />
        <Person cx={CX} cy={CY} r={34} fill="#ffffff" clip="clip-instructor" />
      </motion.g>
    </svg>
  );
}
