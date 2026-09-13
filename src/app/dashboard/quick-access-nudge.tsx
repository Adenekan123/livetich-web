'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PiDeviceMobileBold } from 'react-icons/pi';
import { btn, cn } from '@/lib/ui';

/** Per-device, because the prompt is about *this* phone. Dismissing it on a
 *  laptop should not hide it on the phone they would actually install it on. */
const DISMISS_KEY = 'lt-quick-access-nudge-dismissed';

/**
 * The one moment worth asking.
 *
 * A settings tile alone gets almost no uptake — nobody browses settings. This
 * catches the student on the dashboard, which on a class day is where they
 * already are, and offers the thing that removes the login they are about to
 * do again next week.
 *
 * Only rendered when they have not set one up; dismissing hides it for good on
 * this device, because a nudge that cannot be turned off is an advert.
 */
export function QuickAccessNudge({ workspaceName }: { workspaceName: string | null }) {
  // Starts hidden and appears after mount: reading localStorage during render
  // would disagree with the server-rendered HTML and flash the card at someone
  // who has already dismissed it.
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Private mode or blocked storage: showing it is the safer failure.
    }
    // Deferred a tick so it isn't a synchronous setState inside the effect.
    const t = setTimeout(() => setShow(!dismissed), 0);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-signal-200 bg-gradient-to-r from-signal-50 to-white p-4 sm:flex-row sm:items-center sm:gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal-700 text-white">
        <PiDeviceMobileBold className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-950">
          Skip the login next time
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Put {workspaceName ?? 'your workspace'} on your home screen and open
          today&apos;s classes with a six-digit code.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/account/shortcut" className={btn('primary', 'sm')}>
          Set it up
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              /* not dismissible on this device; hiding it for the session still helps */
            }
            setShow(false);
          }}
          className={cn(btn('ghost', 'sm'), 'text-neutral-500')}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
