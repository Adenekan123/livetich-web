'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
 * GSAP driver for the landing page. Mounted once (renders nothing). It targets
 * server-rendered markup by `data-*` hooks so the page stays a Server Component.
 *
 * Two concerns, kept separate:
 *  1. Nav state — the header is transparent over the dark hero and turns solid
 *     once the hero scrolls past. This runs regardless of motion preference
 *     because it is a legibility state, not decoration.
 *  2. Motion — the hero entrance timeline and scroll parallax. These are gated
 *     behind `prefers-reduced-motion: no-preference` via gsap.matchMedia().
 *
 * Anti-FOUC: animated elements are hidden by CSS (see globals.css) so nothing
 * flashes before hydration. If motion is reduced we reveal them instantly; if
 * JS never runs, a <noscript> style in the page reveals them.
 */
export function LandingGsap() {
  useEffect(() => {
    // Safety net: whatever happens below, the hero must never stay invisible.
    // (The entrance elements start hidden via CSS to prevent a pre-hydration
    // flash — see globals.css.) If setup throws, reveal everything at once.
    const revealAll = () =>
      gsap.set('[data-anim], [data-anim-line], [data-globe]', {
        opacity: 1,
        y: 0,
      });

    try {
      return runMotion();
    } catch {
      revealAll();
      return undefined;
    }

    function runMotion() {
      const nav = document.getElementById('landing-nav');
      const hero = document.querySelector<HTMLElement>('[data-hero]');

    // 1) Nav: solid once the hero is behind us. Not motion-gated.
    let navTrigger: ScrollTrigger | undefined;
    if (nav && hero) {
      navTrigger = ScrollTrigger.create({
        trigger: hero,
        start: 'bottom top+=72',
        onEnter: () => nav.classList.add('is-solid'),
        onLeaveBack: () => nav.classList.remove('is-solid'),
      });
    }

    // 2) Motion, gated on preference.
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      // Reveal everything the anti-FOUC CSS hid — no motion.
      gsap.set('[data-anim], [data-anim-line], [data-globe]', {
        opacity: 1,
        y: 0,
      });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ease = 'power3.out';

      // Hero entrance — one timeline, choreographed. We use fromTo with
      // explicit visible end-states because the anti-FOUC CSS leaves these
      // elements at opacity:0; a plain .from() would animate back to that
      // hidden value and reveal nothing.
      const tl = gsap.timeline({ defaults: { ease } });

      tl.fromTo(
        '[data-anim="status"]',
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.6 },
        0,
      )
        .fromTo(
          '[data-globe]',
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: 1.5, ease: 'power2.out' },
          0,
        )
        .fromTo(
          '[data-anim="eyebrow"]',
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.6 },
          0.15,
        )
        .fromTo(
          '[data-anim-line]',
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, stagger: 0.1 },
          0.25,
        )
        .fromTo(
          '[data-anim="sub"]',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7 },
          0.7,
        )
        .fromTo(
          '[data-anim="cta"]',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6 },
          0.82,
        )
        .fromTo(
          '[data-anim="metric"]',
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.09 },
          0.9,
        )
        .fromTo(
          '[data-anim="footer"]',
          { opacity: 0 },
          { opacity: 1, duration: 0.6 },
          1,
        );

      // Globe: slow vertical drift as the hero scrolls away (yPercent only, to
      // avoid fighting the entrance's scale tween; the SVG's spin is CSS).
      if (hero) {
        gsap.to('[data-globe]', {
          yPercent: 16,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
        gsap.to('[data-hero-grid]', {
          yPercent: 12,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // Decorative blob parallax across the rest of the page.
      const blobs = gsap.utils.toArray<HTMLElement>('[data-parallax]');
      blobs.forEach((el) => {
        const dist = Number(el.dataset.parallax) || 12;
        gsap.to(el, {
          yPercent: dist,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });
    });

      return () => {
        mm.revert();
        navTrigger?.kill();
      };
    }
  }, []);

  return null;
}
