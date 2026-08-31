'use client';

import { useState, useTransition } from 'react';
import { cardClass, cn } from '@/lib/ui';
import type { HeldAssessment } from '@/lib/types';
import {
  releaseAssessment,
  setInstantAssessment,
} from '@/app/actions/assessment';

/**
 * Instructor control over when the class-end quiz reaches students: release it
 * instantly when class ends, or hold it and release each one by hand. Held
 * quizzes appear below with a Release button.
 */
export function ReleaseControls({
  courseId,
  instant,
  held,
}: {
  courseId: string;
  instant: boolean;
  held: HeldAssessment[];
}) {
  const [on, setOn] = useState(instant);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [releasing, setReleasing] = useState<string | null>(null);

  function toggle(next: boolean) {
    setOn(next); // optimistic
    setError(null);
    start(async () => {
      const res = await setInstantAssessment(courseId, next);
      if (res.error) {
        setOn(!next);
        setError(res.error);
      }
    });
  }

  function release(id: string) {
    setReleasing(id);
    setError(null);
    start(async () => {
      const res = await releaseAssessment(courseId, id);
      if (res.error) setError(res.error);
      setReleasing(null);
    });
  }

  return (
    <div className={cn(cardClass, 'mt-6 p-5 sm:p-6')}>
      <h2 className="font-display text-lg font-bold tracking-tight text-neutral-950">
        Release
      </h2>

      <label className="mt-3 flex cursor-pointer items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-950">
            Release the quiz instantly after class
          </span>
          <span className="mt-0.5 block text-sm text-neutral-500">
            {on
              ? 'When a class ends, its quiz is available to students right away.'
              : 'Quizzes are held after class — you release each one below when ready.'}
          </span>
        </span>
        <span className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={on}
            disabled={pending}
            onChange={(e) => toggle(e.target.checked)}
            className="peer sr-only"
          />
          <span className="block h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-signal-600" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {held.length > 0 && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Held quizzes ({held.length})
          </p>
          <ul className="mt-2 space-y-2">
            {held.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {a.topic ?? 'Class-end quiz'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {a.questionCount} question{a.questionCount === 1 ? '' : 's'}
                    {a.endedAt
                      ? ` · ended ${new Date(a.endedAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => release(a.id)}
                  disabled={pending && releasing === a.id}
                  className="shrink-0 rounded-lg bg-signal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-signal-500 disabled:opacity-50"
                >
                  {pending && releasing === a.id ? 'Releasing…' : 'Release'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
