'use client';

import { useSyncExternalStore } from 'react';

/*
 * Landing theme switch. The source of truth is the data-theme attribute on
 * <html> (which the lp-* CSS tokens read); the pre-paint script in the layout
 * sets its initial value. We read it reactively with useSyncExternalStore —
 * no effect, no hydration mismatch (server snapshot is "dark", the client
 * re-syncs to the real attribute) — and flip it on click.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}
const getSnapshot = () =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
const getServerSnapshot = () => 'dark' as const;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('lp-theme', next);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`nav-link grid h-9 w-9 place-items-center rounded-full ${className}`}
    >
      {isDark ? (
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden>
          <path
            d="M17 11.5A6.5 6.5 0 1 1 8.5 3a5.5 5.5 0 0 0 8.5 8.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 2.5v1.6M10 15.9v1.6M17.5 10h-1.6M4.1 10H2.5M15.3 4.7l-1.1 1.1M5.8 14.2l-1.1 1.1M15.3 15.3l-1.1-1.1M5.8 5.8 4.7 4.7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
