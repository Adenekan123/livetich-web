'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { PiClockBold, PiDotsThreeBold } from 'react-icons/pi';
import { joinLiveSession } from '@/app/actions/courses';
import { cn } from '@/lib/ui';

export interface TodayClass {
  courseId: string;
  title: string;
  /** Null when nobody is assigned — a solo instructor teaching their own
   *  program has no separate name to show, and "Unassigned" would report an
   *  internal gap to a student as though it were information about the class. */
  instructor: string | null;
  /** Set when the class is running now. */
  live: boolean;
  /** Start time from today's timetable, e.g. "6:00 PM". Start only: the model
   *  has no class length, so an end time would be invented. */
  at: string | null;
}

/**
 * Everything on this screen joins.
 *
 * The backend's join window covers the whole meeting day, so the time says when
 * to expect everyone else, not when the door unlocks — arriving early lands the
 * student in the room to wait, which is a supported state.
 */
function useJoin(courseId: string) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const join = () =>
    startTransition(async () => {
      setError(null);
      // Success redirects into the room server-side; only failure returns here.
      const res = await joinLiveSession(courseId);
      if (res?.error) setError(res.error);
    });
  return { pending, error, join };
}

/**
 * One class, one card.
 *
 * Title, when it starts, and the single thing you came to do — sitting bottom
 * right where a thumb reaches it. The overflow affordance carries the secondary
 * route to the program page, so the card keeps exactly one primary action.
 *
 * Live is marked three ways, never colour alone: the word, a pulsing dot, and a
 * stronger fill on the action.
 */
function ClassCard({ item }: { item: TodayClass }) {
  const { pending, error, join } = useJoin(item.courseId);

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-neutral-950">
            {item.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-500">
            {item.live ? (
              <>
                <span
                  className="animate-live h-2 w-2 rounded-full bg-rose-600"
                  aria-hidden
                />
                <span className="font-semibold text-rose-600">Live now</span>
              </>
            ) : (
              <>
                <PiClockBold className="h-4 w-4 shrink-0" aria-hidden />
                {item.at}
              </>
            )}
          </p>
          {item.instructor && (
            <p className="mt-1 truncate text-sm text-neutral-500">
              {item.instructor}
            </p>
          )}
        </div>
        <Link
          href={`/courses/${item.courseId}`}
          aria-label={`View ${item.title}`}
          title="View program"
          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <PiDotsThreeBold className="h-5 w-5" />
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {error && (
          <p role="alert" className="min-w-0 flex-1 text-sm text-rose-600">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className={cn(
            // Soft-filled pill: the template's shape, in the product's own
            // teal. 44px tall so it is a real target on a phone, and outlined
            // so the button reads as a button on a white card rather than as a
            // tinted label.
            'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-6 text-sm font-semibold transition',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal-600/20',
            item.live
              ? 'border-signal-900 bg-signal-700 text-white hover:bg-signal-800'
              : 'border-signal-200 bg-signal-50 text-signal-700 hover:border-signal-300 hover:bg-signal-100',
            pending && 'opacity-60',
          )}
        >
          {pending ? 'Joining…' : 'Join'}
          {!pending && (
            <span aria-hidden className="text-[15px] leading-none">
              →
            </span>
          )}
        </button>
      </div>
    </li>
  );
}

/**
 * The shortcut's home: today, and nothing else.
 *
 * Deliberately not the dashboard. A student opening this from their home screen
 * has one question — is my class on, and how do I get in — and every other panel
 * is in the way of answering it. Installed, there is no browser chrome and no
 * back button, so the layout owns the viewport, pads itself clear of the notch
 * and the home indicator, and keeps exactly one way back.
 */
export function TodayScreen({
  workspaceName,
  logoUrl,
  accent,
  firstName,
  classes,
  nextUp,
}: {
  workspaceName: string;
  logoUrl: string | null;
  accent: string | null;
  firstName: string;
  classes: TodayClass[];
  /** When today is empty: when the next class actually is. */
  nextUp: string | null;
}) {
  // Live first; the rest in timetable order, as the page computed them.
  const ordered = [...classes].sort((a, b) => Number(b.live) - Number(a.live));

  return (
    <div
      className="min-h-screen bg-neutral-50"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-5">
        <header className="flex items-center gap-3 px-1">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <span
              className="grid h-9 w-9 place-items-center rounded-xl font-display text-xs font-extrabold text-white"
              style={{ background: accent ?? '#0f766e' }}
              aria-hidden
            >
              {workspaceName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <p className="min-w-0 flex-1 truncate font-display text-[17px] font-extrabold tracking-[-0.01em] text-neutral-950">
            {workspaceName}
          </p>
          <p className="shrink-0 text-sm text-neutral-500">Hi {firstName}</p>
        </header>

        <h1 className="mt-7 px-1 text-[15px] font-semibold text-neutral-500">
          Today
        </h1>

        {ordered.length > 0 ? (
          <ul className="mt-2.5 space-y-3">
            {ordered.map((c) => (
              <ClassCard key={c.courseId} item={c} />
            ))}
          </ul>
        ) : (
          <div className="mt-2.5 rounded-2xl border border-neutral-200 bg-white p-6">
            <p className="font-semibold text-neutral-950">Nothing on today</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              {nextUp
                ? `Your next class is ${nextUp}. It will appear here on the day, ready to join.`
                : 'When a class is scheduled it will appear here, ready to join.'}
            </p>
          </div>
        )}

        <div className="mt-auto pt-10 text-center">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
          >
            Go to dashboard →
          </Link>
        </div>
      </main>
    </div>
  );
}
