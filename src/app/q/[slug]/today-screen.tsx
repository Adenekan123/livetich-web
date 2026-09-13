'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { joinLiveSession } from '@/app/actions/courses';
import { btn, cn } from '@/lib/ui';

export interface TodayClass {
  courseId: string;
  title: string;
  /** Null when nobody is assigned — a solo instructor teaching their own
   *  program has no separate name to show, and "Unassigned" would report an
   *  internal gap to a student as though it were information about the class. */
  instructor: string | null;
  /** Set when the class is running now. */
  live: boolean;
  /** Human time from today's timetable, e.g. "6:00 PM". */
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
 * The class that is on right now.
 *
 * Given its own block rather than a row, because when something is live it is
 * the whole answer to the question this screen exists to ask. The target runs
 * the full width of the phone: a student walking into class late should not
 * have to aim.
 */
function LiveClass({ item }: { item: TodayClass }) {
  const { pending, error, join } = useJoin(item.courseId);
  return (
    <section className="animate-fade-up mt-5">
      <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-rose-600">
        <span className="animate-live h-2 w-2 rounded-full bg-rose-600" aria-hidden />
        Live now
      </p>
      <h2 className="mt-2 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-neutral-950">
        {item.title}
      </h2>
      {item.instructor && (
        <p className="mt-1 text-[15px] text-neutral-500">{item.instructor}</p>
      )}
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className={cn(
          btn('primary', 'lg'),
          'mt-4 w-full justify-center py-4 text-base',
          pending && 'opacity-70',
        )}
      >
        {pending ? 'Joining…' : 'Join class'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * One line of the day's timetable.
 *
 * A hairline row rather than a card: a timetable is a list of times, and the
 * time is what a student scans for. Boxing each one would give the container
 * the same weight as the class inside it.
 */
function ScheduledClass({ item }: { item: TodayClass }) {
  const { pending, error, join } = useJoin(item.courseId);
  return (
    <li className="border-t border-neutral-200 first:border-t-0">
      <div className="flex items-center gap-3 py-3.5">
        <span className="w-[68px] shrink-0 font-mono text-[13px] font-semibold tabular-nums text-neutral-500">
          {item.at}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-950">{item.title}</p>
          {item.instructor && (
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {item.instructor}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className={cn(btn('secondary', 'md'), 'shrink-0', pending && 'opacity-70')}
        >
          {pending ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error && (
        <p role="alert" className="pb-3 text-sm text-rose-600">
          {error}
        </p>
      )}
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
  const live = classes.filter((c) => c.live);
  const scheduled = classes.filter((c) => !c.live);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-5">
        <header className="flex items-center gap-3 border-b border-neutral-200 pb-4">
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

        {/* neutral-500, not 400: the date is content, and 400 on white is
            about 2.5:1 — under the 4.5:1 floor for text this size. */}
        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
          {today}
        </p>

        {live.map((c) => (
          <LiveClass key={c.courseId} item={c} />
        ))}

        {scheduled.length > 0 && (
          <section className="mt-7">
            {live.length > 0 && (
              <h3 className="mb-1 text-sm font-semibold text-neutral-500">
                Also today
              </h3>
            )}
            <ul>
              {scheduled.map((c) => (
                <ScheduledClass key={c.courseId} item={c} />
              ))}
            </ul>
          </section>
        )}

        {classes.length === 0 && (
          <section className="mt-7">
            <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-neutral-950">
              Nothing on today
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
              {nextUp
                ? `Your next class is ${nextUp}. It will appear here on the day, ready to join.`
                : 'When a class is scheduled it will appear here, ready to join.'}
            </p>
          </section>
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
