'use client';

import { useActionState, useState } from 'react';
import { createCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';
import { DurationField } from './duration-field';
import { MeetingSchedule } from './meeting-schedule';

interface BatchRow {
  label: string;
  days: number[];
  time: string;
  tz: string;
}

/**
 * Optional batches created together with the program. Each is a scheduled
 * instance (its own days/time/timezone) that inherits the program's content.
 * Values are serialized into a hidden field the create action reads.
 */
function BatchRows({ timezones }: { timezones: string[] }) {
  const [rows, setRows] = useState<BatchRow[]>([]);

  const update = (i: number, patch: Partial<BatchRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const toggleDay = (i: number, d: number) =>
    update(i, {
      days: rows[i].days.includes(d)
        ? rows[i].days.filter((x) => x !== d)
        : [...rows[i].days, d],
    });

  const serialized = JSON.stringify(
    rows.map((r) => ({
      label: r.label,
      meetingDays: r.days,
      meetingTime: r.time,
      timezone: r.tz,
    })),
  );

  return (
    <div className="border-t border-neutral-200 pt-4">
      <input type="hidden" name="batches" value={serialized} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Batches (optional)
        </p>
        <button
          type="button"
          onClick={() =>
            setRows((r) => [
              ...r,
              { label: '', days: [], time: '09:00', tz: 'Africa/Lagos' },
            ])
          }
          className="text-xs font-semibold text-signal-700 hover:text-signal-600"
        >
          + Add batch
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Run this program at more than one time (e.g. Batch A morning, Batch B
        afternoon). You can also add batches later.
      </p>

      {rows.map((row, i) => (
        <div
          key={i}
          className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Batch label (e.g. Batch A · Morning)"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              aria-label="Remove batch"
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, di) => (
              <button
                key={di}
                type="button"
                onClick={() => toggleDay(i, di)}
                aria-pressed={row.days.includes(di)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition ${
                  row.days.includes(di)
                    ? 'border-signal-700 bg-signal-700 text-white'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={row.time}
              onChange={(e) => update(i, { time: e.target.value })}
              className={inputClass}
            />
            <select
              value={row.tz}
              onChange={(e) => update(i, { tz: e.target.value })}
              className={inputClass}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.split('/').pop()?.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

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

/** Local YYYY-MM-DD for a <input type="date"> default. */
function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Create-program form (used inside the New program modal on /courses). */
export function NewProgramForm() {
  const [state, action] = useActionState(createCourse, initial);
  // Default the start date to today so a program created to run now actually has
  // an occurrence today — without a start date the schedule yields zero sessions
  // and "Join"/"Go live" stays disabled from the first render. The admin can
  // still push it to a future start.
  const today = todayLocal();
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

        <div className="mt-3">
          <DurationField defaultWeeks={8} defaultStartDate={today} />
        </div>

        <div className="mt-3">
          <MeetingSchedule />
        </div>

        <div className="mt-3 space-y-1.5">
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

      <BatchRows timezones={TIMEZONES} />

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
