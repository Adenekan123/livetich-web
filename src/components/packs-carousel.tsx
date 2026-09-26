'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react';

/*
 * Horizontal, scroll-snapping row for the teaching-pack cards. It runs edge to
 * edge of the viewport (the track's padding lines the first card up with the
 * page gutter). Arrows, dots and the "scroll to explore" hint only appear when
 * the cards actually overflow. Motion follows the reduced-motion preference.
 */
export function PacksCarousel({
  children,
  label,
  trackClassName = '',
}: {
  children: ReactNode;
  label: string;
  trackClassName?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const count = Children.count(children);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setOverflows(max > 4);
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft >= max - 4);
      // The card whose left edge is nearest the track's first-card position is "active".
      const items = Array.from(el.children) as HTMLElement[];
      const origin = items[0]?.offsetLeft ?? 0;
      let nearest = 0;
      let best = Infinity;
      items.forEach((item, i) => {
        const d = Math.abs(item.offsetLeft - origin - el.scrollLeft);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      setActive(el.scrollLeft >= max - 4 ? items.length - 1 : nearest);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    el.addEventListener('scroll', sync, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', sync);
    };
  }, []);

  const behavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const item = items[i];
    if (!item) return;
    el.scrollTo({ left: item.offsetLeft - items[0].offsetLeft, behavior: behavior() });
  };

  const step = (dir: 1 | -1) => goTo(Math.min(count - 1, Math.max(0, active + dir)));

  const arrow =
    'absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-[#0a0a0a] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0 sm:grid';

  return (
    <div>
      <div className="relative">
        <div
          ref={trackRef}
          role="region"
          aria-label={label}
          tabIndex={0}
          className={`flex snap-x snap-mandatory gap-5 overflow-x-auto py-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-lp-accent [&::-webkit-scrollbar]:hidden ${trackClassName}`}
        >
          {children}
        </div>

        {overflows && (
          <>
            <button type="button" onClick={() => step(-1)} disabled={atStart} aria-label="Previous pack" className={`${arrow} left-4 lg:left-8`}>
              <CaretLeft weight="bold" className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => step(1)} disabled={atEnd} aria-label="Next pack" className={`${arrow} right-4 lg:right-8`}>
              <CaretRight weight="bold" className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {overflows && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to pack ${i + 1} of ${count}`}
                aria-current={i === active}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === active ? 'bg-[#16a34a]' : 'bg-lp-border-2 hover:bg-lp-text-3'
                }`}
              />
            ))}
          </div>
          <p className="flex items-center gap-4 text-[15px] text-lp-text-3">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Scroll to explore more packs
            <ArrowRight className="h-4 w-4" aria-hidden />
          </p>
        </div>
      )}
    </div>
  );
}
