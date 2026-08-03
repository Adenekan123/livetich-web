'use client';

import { useState, useTransition } from 'react';
import { joinLiveSession } from '@/app/actions/courses';
import { btn, cn } from '@/lib/ui';

/**
 * The single entry point into a program's live class. Enabled only on a
 * scheduled meeting day (from the meeting time onward) — the backend decides,
 * we just reflect `joinableNow`. On other days it shows the next meeting.
 */
export function JoinLiveCard({
  courseId,
  canJoin,
  isInstructor,
  joinableNow,
  isLive,
  nextAt,
  timezone,
}: {
  courseId: string;
  canJoin: boolean;
  isInstructor: boolean;
  joinableNow: boolean;
  isLive: boolean;
  nextAt: string | null;
  timezone: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onJoin() {
    setError(null);
    startTransition(async () => {
      const res = await joinLiveSession(courseId);
      // Success redirects server-side; only an error state returns here.
      if (res?.error) setError(res.error);
    });
  }

  const when = nextAt
    ? new Date(nextAt).toLocaleString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone ?? undefined,
      })
    : null;

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {joinableNow ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              {isLive ? (
                <>
                  <span className="animate-live h-2 w-2 rounded-full bg-signal-500" />
                  Class is live now
                </>
              ) : isInstructor ? (
                'Ready to start'
              ) : (
                'Class is open — you can join'
              )}
            </p>
          ) : (
            <p className="text-sm font-semibold text-neutral-900">
              No class in session
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            {joinableNow
              ? isInstructor
                ? isLive
                  ? 'Your session is live — rejoin to continue teaching.'
                  : 'Join to go live — enrolled students can then enter the room.'
                : isLive
                  ? 'Your instructor has started the session.'
                  : 'Join now — your instructor will be with you shortly.'
              : when
                ? `Next session: ${when}`
                : 'No upcoming sessions scheduled.'}
          </p>
        </div>

        {canJoin && (
          <button
            onClick={onJoin}
            disabled={!joinableNow || pending}
            className={cn(
              btn('primary'),
              (!joinableNow || pending) && 'cursor-not-allowed opacity-50',
            )}
          >
            {pending
              ? 'Joining…'
              : isInstructor
                ? isLive
                  ? 'Rejoin class →'
                  : 'Go live →'
                : isLive
                  ? 'Join live class →'
                  : 'Join session →'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
