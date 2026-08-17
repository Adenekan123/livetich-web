'use client';

import { useActionState } from 'react';
import { createCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: ActionState = { error: null };

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; // index = 0..6 (Sun..Sat)
const DURATIONS = [
  { w: 4, label: '4 weeks (1 month)' },
  { w: 6, label: '6 weeks' },
  { w: 8, label: '8 weeks (2 months)' },
  { w: 12, label: '12 weeks (3 months)' },
];
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

/** Create-program form (used inside the New program modal on /courses). */
export function NewProgramForm() {
  const [state, action] = useActionState(createCourse, initial);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />

      <div className="space-y-1.5">
        <label htmlFor="title" className={labelClass}>
          Program title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Full-Stack Foundations"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What will students learn, and who is it for?"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <input
            id="category"
            name="category"
            list="course-categories"
            placeholder="Software Engineering"
            className={inputClass}
          />
          <datalist id="course-categories">
            <option value="Software Engineering" />
            <option value="Design" />
            <option value="Business" />
            <option value="Data" />
            <option value="Languages" />
          </datalist>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="level" className={labelClass}>
            Level
          </label>
          <select id="level" name="level" defaultValue="" className={inputClass}>
            <option value="">—</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Schedule */}
      <div className="border-t border-neutral-200 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Cohort schedule
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="startDate" className={labelClass}>
              Start date
            </label>
            <input id="startDate" name="startDate" type="date" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="durationWeeks" className={labelClass}>
              Duration
            </label>
            <select
              id="durationWeeks"
              name="durationWeeks"
              defaultValue="8"
              className={inputClass}
            >
              {DURATIONS.map((d) => (
                <option key={d.w} value={d.w}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
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
              defaultValue="18:00"
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
              defaultValue="Africa/Lagos"
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

      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create program
      </SubmitButton>
      <p className="text-xs text-neutral-400">
        You can assign an instructor, schedule live sessions, and add curriculum
        after the program is created.
      </p>
    </form>
  );
}
