'use client';

/*
 * Landing motion primitives. Built on `motion` (already a dependency) rather
 * than pulling in GSAP — livetich is a low-bandwidth-first product, so the
 * marketing page stays light: transforms and opacity only (compositor-friendly),
 * and every effect collapses to a static render under prefers-reduced-motion.
 * Timings mirror the ui-ux-pro-max motion presets (power2.out ≈ [0.22,1,0.36,1],
 * ~500ms reveals, 0.08 stagger).
 */

import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Single fade-and-rise as the element scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'li' | 'section' | 'span';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  );
}

const groupParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const groupChild: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Container that staggers its <Stagger.Item> children into view. */
export function Stagger({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'tbody' | 'dl';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <MotionTag
      className={className}
      variants={groupParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'tr';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <MotionTag className={className} variants={groupChild}>
      {children}
    </MotionTag>
  );
}

/**
 * Count a number up from 0 when it enters the viewport. Props are serializable
 * (no function props) so this renders as a child of a Server Component. Use
 * `prefix`/`suffix`/`decimals` to render "40+", "99.9%", "6×", "1,500", etc.
 */
export function CountUp({
  to,
  className,
  duration = 1.4,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  to: number;
  className?: string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  const shown =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/**
 * Headline that reveals word by word. `highlight` underlines one matching word
 * (case-insensitive) without breaking the stagger.
 */
export function WordReveal({
  text,
  highlight,
  className,
}: {
  text: string;
  highlight?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const words = text.split(' ');

  if (reduce) {
    return (
      <h1 className={className}>
        {words.map((w, i) => {
          const hit =
            highlight && w.toLowerCase().replace(/[.,]/g, '') === highlight.toLowerCase();
          return (
            <span key={i}>
              {hit ? (
                <span className="underline decoration-signal-500 decoration-[0.08em] underline-offset-[0.12em]">
                  {w}
                </span>
              ) : (
                w
              )}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </h1>
    );
  }

  return (
    <motion.h1
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
      style={{ perspective: 800 }}
    >
      {words.map((w, i) => {
        const hit =
          highlight && w.toLowerCase().replace(/[.,]/g, '') === highlight.toLowerCase();
        return (
          <span
            key={i}
            className="inline-block overflow-hidden align-bottom"
            style={{ paddingBottom: '0.06em' }}
          >
            <motion.span
              className="inline-block"
              variants={{
                hidden: { y: '110%', opacity: 0, rotateX: -35 },
                show: {
                  y: 0,
                  opacity: 1,
                  rotateX: 0,
                  transition: { duration: 0.6, ease: EASE },
                },
              }}
            >
              {hit ? (
                <span className="underline decoration-signal-500 decoration-[0.08em] underline-offset-[0.12em]">
                  {w}
                </span>
              ) : (
                w
              )}
            </motion.span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </motion.h1>
  );
}
