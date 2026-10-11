'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PiShieldCheckFill, PiX } from 'react-icons/pi';
import { btn } from '@/lib/ui';

const STORAGE_KEY = 'lt_cookie_consent';
const COOKIE_NAME = 'lt_cookie_consent';

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has already made a consent decision
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setOpen(true);
      }
    } catch {
      // If localStorage is blocked, do nothing
    }
  }, []);

  const saveConsent = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
      document.cookie = `${COOKIE_NAME}=${choice}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignored
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed bottom-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 bg-white/95 p-5 shadow-2xl backdrop-blur-md transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal-100 text-signal-700 dark:bg-signal-950 dark:text-signal-300">
            <PiShieldCheckFill className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            Cookie Preferences
          </h2>
        </div>
        <button
          type="button"
          onClick={() => saveConsent('essential')}
          aria-label="Dismiss cookie notice"
          className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
        We use essential cookies to maintain your login session and deliver secure live classes.
        With your permission, we also use anonymized telemetry to improve streaming performance
        and class stability.
      </p>

      <div className="mt-2 text-xs">
        <Link
          href="/cookies"
          className="font-medium text-signal-700 underline underline-offset-2 hover:text-signal-800 dark:text-signal-400"
        >
          Read our Cookie Policy &rarr;
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={() => saveConsent('essential')}
          className={btn('secondary', 'sm')}
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={() => saveConsent('all')}
          className={btn('primary', 'sm')}
        >
          Accept All
        </button>
      </div>
    </aside>
  );
}
