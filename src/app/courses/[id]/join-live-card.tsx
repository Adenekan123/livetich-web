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
  hasAssessment = true,
}: {
  courseId: string;
  canJoin: boolean;
  isInstructor: boolean;
  joinableNow: boolean;
  isLive: boolean;
  nextAt: string | null;
  timezone: string | null;
  /** Does the course have an authored class-end assessment? Instructors are
   *  warned before going live without one (no quiz will materialize on end). */
  hasAssessment?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await joinLiveSession(courseId);
      // Success redirects server-side; only an error state returns here.
      if (res?.error) setError(res.error);
    });
  }

  function onJoin() {
    // Instructor about to go live (not rejoin) with no assessment configured:
    // confirm first, since no post-class quiz will be generated.
    if (isInstructor && !isLive && !hasAssessment) {
      setConfirmOpen(true);
      return;
    }
    join();
  }

  // Guarded: an invalid/unsupported timezone (e.g. a stray "GMT+1") makes
  // toLocaleString throw, which would crash this card on render/hydration and
  // leave the Join button un-clickable. Fall back to the viewer's local zone.
  const when = ((): string | null => {
    if (!nextAt) return null;
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    try {
      return new Date(nextAt).toLocaleString(undefined, {
        ...opts,
        timeZone: timezone ?? undefined,
      });
    } catch {
      try {
        return new Date(nextAt).toLocaleString(undefined, opts);
      } catch {
        return null;
      }
    }
  })();

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {joinableNow ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              {isLive ? (
                <>
                  <span className="animate-live h-2 w-2 rounded-full bg-signal-500" />
                  Live now
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
              // Pulse the CTA while the room is open/live to draw the eye.
              joinableNow && !pending && 'animate-live',
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

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="golive-confirm-title"
            aria-describedby="golive-confirm-desc"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:p-7"
          >
            <h2
              id="golive-confirm-title"
              className="font-display text-xl font-extrabold tracking-tight text-neutral-950"
            >
              Go live without an end-of-class assessment?
            </h2>
            <p id="golive-confirm-desc" className="mt-2 text-sm text-neutral-600">
              This program has no assessment questions configured, so no
              post-class quiz will be generated when this session ends. You can
              add questions from the Assessments tool first, or continue anyway.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className={btn('secondary')}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  join();
                }}
                className={btn('primary')}
              >
                Go live anyway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
