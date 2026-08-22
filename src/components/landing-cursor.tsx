'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/*
 * GSAP-driven cursor for the landing page: a soft lime glow that trails the
 * pointer plus a small dot that tracks it tightly. The native cursor stays
 * visible (this is an accent, not a replacement). Disabled on coarse pointers
 * and under reduced motion (CSS hides the elements; we also bail early here).
 */
export function LandingCursor() {
  const glowRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    const dot = dotRef.current;
    if (!glow || !dot) return;
    if (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    // Trailing glow (loose) and a tight dot.
    const gx = gsap.quickTo(glow, 'x', { duration: 0.55, ease: 'power3' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.55, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.14, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.14, ease: 'power3' });

    let shown = false;
    const onMove = (e: MouseEvent) => {
      if (!shown) {
        shown = true;
        gsap.to([glow, dot], { opacity: 1, duration: 0.3 });
      }
      gx(e.clientX);
      gy(e.clientY);
      dx(e.clientX);
      dy(e.clientY);
    };
    const onLeave = () => gsap.to([glow, dot], { opacity: 0, duration: 0.3 });

    // Grow the glow over interactive targets.
    const grow = () => gsap.to(glow, { scale: 1.6, duration: 0.3, ease: 'power3' });
    const shrink = () => gsap.to(glow, { scale: 1, duration: 0.3, ease: 'power3' });
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('a, button, [role="button"]'),
    );

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    targets.forEach((t) => {
      t.addEventListener('mouseenter', grow);
      t.addEventListener('mouseleave', shrink);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      targets.forEach((t) => {
        t.removeEventListener('mouseenter', grow);
        t.removeEventListener('mouseleave', shrink);
      });
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="cursor-glow" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  );
}
