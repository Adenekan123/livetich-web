'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { joinLiveSession } from '@/app/actions/courses';
import { btn } from '@/lib/ui';

/**
 * The button, for someone already signed in.
 *
 * `joinLiveSession` resolves today's room — materialising it if this is the
 * first arrival — and redirects server-side into the session, where the
 * prejoin screen takes over. Only a failure comes back here, which is why
 * there is no success state to render.
 *
 * Outside the join window the page still says when class is (the chip above)
 * and offers the dashboard: a student who opened the link early should see
 * that they are in the right place and early, not an empty page that looks
 * broken — and have somewhere to go meanwhile.
 */
/** Start watching for the room to open this long before class. */
const WATCH_BEFORE_MS = 15 * 60_000;
const POLL_MS = 30_000;
const MAX_TIMER_MS = 2 ** 31 - 1;

export function JoinPanel({
  courseId,
  joinableNow,
  isLive,
  when,
  nextAt,
  name,
}: {
  courseId: string;
  joinableNow: boolean;
  isLive: boolean;
  when: string | null;
  /** Start of the next class (ISO), when one is scheduled. */
  nextAt: string | null;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Early: once the room opens the page itself takes a student straight in, so
  // someone waiting here needs no reload and no click. But only look again in
  // the last stretch before class — a tab left open on Monday for a Friday
  // class must not ask the server every half minute for four days. Until then
  // it is one local timer and no requests at all.
  useEffect(() => {
    if (joinableNow || !nextAt) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      router.refresh();
      poll = setInterval(() => router.refresh(), POLL_MS);
    };
    const untilWatch = new Date(nextAt).getTime() - WATCH_BEFORE_MS - Date.now();
    // Browsers run a timer longer than ~24.8 days at once; a class that far
    // off is not worth watching from this tab anyway.
    if (untilWatch > MAX_TIMER_MS) return;
    const wait = setTimeout(startPolling, Math.max(0, untilWatch));
    return () => {
      clearTimeout(wait);
      clearInterval(poll);
    };
  }, [joinableNow, nextAt, router]);

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await joinLiveSession(courseId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div>
      <p className="text-sm text-neutral-600">
        Joining as <span className="font-semibold text-neutral-900">{name}</span>
        . You&apos;ll check your camera and microphone on the next screen.
      </p>

      {joinableNow ? (
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className={btn('primary', 'xl', 'mt-4 w-full sm:w-auto')}
        >
          {pending ? 'Opening the room…' : isLive ? 'Join class' : 'Enter the room'}
        </button>
      ) : (
        // Nothing to join yet, so the useful way on is the dashboard. The
        // status chip above already carries the date and time; repeating it
        // here would be two sentences saying one thing.
        <>
          <p className="mt-3 text-sm text-neutral-500">
            {when
              ? 'The room opens at class time — this link takes you in then.'
              : 'This cohort has no class scheduled right now.'}
          </p>
          <Link
            href="/dashboard"
            className={btn('primary', 'xl', 'mt-4 w-full sm:w-auto')}
          >
            Go to dashboard
          </Link>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
