'use client';

import { useState, useTransition } from 'react';
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
 * Outside the join window the button stays, disabled, rather than vanishing: a
 * student who opened the link an hour early should see that they are in the
 * right place and early, not an empty page that looks broken.
 */
export function JoinPanel({
  courseId,
  joinableNow,
  isLive,
  when,
  name,
}: {
  courseId: string;
  joinableNow: boolean;
  isLive: boolean;
  when: string | null;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

      <button
        type="button"
        onClick={join}
        disabled={!joinableNow || pending}
        className={btn('primary', 'xl', 'mt-4 w-full sm:w-auto')}
      >
        {pending ? 'Opening the room…' : isLive ? 'Join class' : 'Enter the room'}
      </button>

      {!joinableNow && (
        // The status chip above already carries the date and time; repeating
        // it here would be two sentences saying one thing.
        <p className="mt-3 text-sm text-neutral-500">
          {when
            ? 'The room opens at class time.'
            : 'This cohort has no class scheduled right now.'}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
