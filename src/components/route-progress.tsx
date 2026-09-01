'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * A slim linear progress bar pinned to the top of every page while a client-side
 * navigation is in flight. It starts on an internal link click and completes
 * when the new route commits (the pathname changes). Dependency-free, and it
 * self-clears on a safety timeout so a blocked/cancelled navigation can't leave
 * it stuck. Purely decorative — hidden from assistive tech.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setActive(true);
    setWidth(8);
    // Trickle toward 90% so a slow load keeps visibly moving.
    const tick = (w: number) => {
      const next = Math.min(90, w + (90 - w) * 0.15);
      setWidth(next);
      timers.current.push(setTimeout(() => tick(next), 220));
    };
    timers.current.push(setTimeout(() => tick(8), 220));
    // Safety net: if the route never changes (blocked nav, same page), finish.
    timers.current.push(setTimeout(() => finish(), 8000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    setWidth(100);
    timers.current.push(
      setTimeout(() => {
        setActive(false);
        setWidth(0);
      }, 350),
    );
  }, [clearTimers]);

  // Start on internal, same-origin link clicks that actually navigate.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (
        !href ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (or hash-only) — no navigation to show progress for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      start();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [start]);

  // Complete when the route commits.
  useEffect(() => {
    if (active) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
    >
      <div
        className="h-full bg-signal-600 shadow-[0_0_8px_rgba(101,163,13,0.6)]"
        style={{
          width: `${width}%`,
          opacity: active ? 1 : 0,
          transition: 'width 220ms ease, opacity 350ms ease',
        }}
      />
    </div>
  );
}
