'use client';

import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/actions/auth';
import { btn } from '@/lib/ui';

// Log out after this much inactivity; warn the user this long before.
const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 60 * 1000; // 60 seconds
// Shared across tabs so activity anywhere keeps the whole session alive.
const KEY = 'lt_last_active';

/**
 * Signs the user out after a period of inactivity. Activity is tracked in
 * localStorage so multiple tabs share one idle clock; a countdown modal warns
 * before the session ends so no one is dropped mid-task without notice.
 */
export function IdleLogout() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const loggingOut = useRef(false);

  useEffect(() => {
    const mark = () => localStorage.setItem(KEY, String(Date.now()));
    mark();

    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 1000) {
        last = now;
        mark();
        setRemaining((r) => (r != null ? null : r));
      }
    };
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ] as const;
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    const tick = setInterval(() => {
      const lastActive = Number(localStorage.getItem(KEY) ?? Date.now());
      const idle = Date.now() - lastActive;
      if (idle >= IDLE_MS) {
        if (!loggingOut.current) {
          loggingOut.current = true;
          clearInterval(tick);
          void logout();
        }
      } else if (idle >= IDLE_MS - WARN_MS) {
        setRemaining(Math.ceil((IDLE_MS - idle) / 1000));
      } else {
        setRemaining((r) => (r != null ? null : r));
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, []);

  if (remaining == null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <h2 className="text-lg font-bold text-neutral-950">Still there?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          You&apos;ll be signed out in{' '}
          <span className="font-semibold text-neutral-900">{remaining}s</span> due
          to inactivity.
        </p>
        <button
          onClick={() => {
            localStorage.setItem(KEY, String(Date.now()));
            setRemaining(null);
          }}
          className={btn('primary', 'sm', 'mt-5 w-full justify-center')}
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
