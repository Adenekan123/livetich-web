'use client';

import { useState, useTransition } from 'react';
import { joinLiveSession } from '@/app/actions/courses';
import { btn, cardClass, cn } from '@/lib/ui';

/**
 * Admin entry into a live class. Two ways in:
 *  • Shadow join — a hidden LiveKit token; neither the instructor nor students
 *    see the admin. For oversight.
 *  • Join as instructor — a solo-teacher admin enters as the host (visible,
 *    publishing, host controls) and going live this way opens the room. Lets an
 *    owner teach any program without assigning a separate instructor.
 */
export function ShadowJoinCard({
  courseId,
  live,
  joinableNow,
}: {
  courseId: string;
  live: boolean;
  joinableNow: boolean;
}) {
  const [pending, startJoin] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onJoin(mode?: 'teach') {
    setError(null);
    startJoin(async () => {
      const res = await joinLiveSession(courseId, mode);
      // Success redirects server-side; only an error returns here.
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className={cn(cardClass, 'p-4')}>
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
        Admin
      </p>
      <p className="mb-3 mt-1.5 text-sm text-neutral-500">
        {live
          ? 'A class is live. Drop in to observe, or take over teaching.'
          : joinableNow
            ? 'Class is open. Observe unseen, or join as the instructor to teach.'
            : 'No class in session right now.'}
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onJoin('teach')}
          disabled={!joinableNow || pending}
          className={cn(
            btn('primary', 'sm'),
            (!joinableNow || pending) && 'cursor-not-allowed opacity-50',
          )}
        >
          {pending ? 'Joining…' : 'Join as instructor →'}
        </button>
        <button
          onClick={() => onJoin()}
          disabled={!joinableNow || pending}
          className={cn(
            btn('secondary', 'sm'),
            (!joinableNow || pending) && 'cursor-not-allowed opacity-50',
          )}
        >
          Shadow join →
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
