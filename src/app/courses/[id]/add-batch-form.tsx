'use client';

import { useActionState } from 'react';
import { createBatch, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';
import { DurationField } from '../duration-field';

const initial: ActionState = { error: null };

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; // index = 0..6 (Sun..Sat)
const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Nairobi',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
];

/**
 * Create a batch of a program. Identity + curriculum are inherited; this form
 * captures only what makes a batch distinct — its label and its own schedule
 * (days, time, timezone, start, duration). Left blank, a field inherits the
 * program's cadence.
 */
export function AddBatchForm({
  programId,
  defaultWeeks,
  defaultTimezone,
}: {
  programId: string;
  defaultWeeks: number | null;
  defaultTimezone: string | null;
}) {
  const [state, action] = useActionState(
    createBatch.bind(null, programId),
    initial,
  );
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />

      <div className="space-y-1.5">
        <label htmlFor="label" className={labelClass}>
          Batch label
        </label>
        <input
          id="label"
          name="label"
          required
          placeholder="e.g. Batch A · Morning"
          className={inputClass}
        />
        <p className="text-xs text-neutral-400">
          Shown to students so they can pick the right time. The program&apos;s
          curriculum and assessments are copied into the batch automatically.
        </p>
      </div>

      {/* Schedule */}
      <div className="border-t border-neutral-200 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Batch schedule
        </p>

        <div className="mt-3">
          <DurationField defaultWeeks={defaultWeeks ?? 8} />
        </div>

        <div className="mt-3 space-y-1.5">
          <span className={labelClass}>Meeting days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <label key={i} className="cursor-pointer">
                <input type="checkbox" name="meetingDays" value={i} className="peer sr-only" />
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium text-neutral-600 transition hover:border-neutral-500 peer-checked:border-signal-700 peer-checked:bg-signal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-signal-400 peer-focus-visible:ring-offset-1">
                  {d}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="meetingTime" className={labelClass}>
              Start time
            </label>
            <input
              id="meetingTime"
              name="meetingTime"
              type="time"
              defaultValue="09:00"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="timezone" className={labelClass}>
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={defaultTimezone ?? 'Africa/Lagos'}
              className={inputClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.split('/').pop()?.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating batch…">
        Create batch
      </SubmitButton>
    </form>
  );
}
