'use client';

import { useState, useTransition } from 'react';
import { joinLiveSession } from '@/app/actions/courses';
import { btn, cardClass, cn } from '@/lib/ui';

/**
 * Admin-only entry into a live class as a hidden observer. The join resolves
 * the current session (server-side admins are allowed) and the room mints a
 * hidden LiveKit token — neither the instructor nor the students see the admin.
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

  function onJoin() {
    setError(null);
    startJoin(async () => {
      const res = await joinLiveSession(courseId);
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
          ? 'A class is live. Drop in to observe — you stay hidden from the instructor and students.'
          : joinableNow
            ? 'Class is open. Shadow-join to observe without being seen.'
            : 'No class in session right now.'}
      </p>
      <button
        onClick={onJoin}
        disabled={!joinableNow || pending}
        className={cn(
          btn('primary', 'sm'),
          (!joinableNow || pending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {pending ? 'Joining…' : 'Shadow join →'}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
