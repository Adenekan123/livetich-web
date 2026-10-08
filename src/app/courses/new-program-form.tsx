'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { PiPlusBold } from 'react-icons/pi';
import { createCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';
import { DurationField } from './duration-field';
import { MeetingSchedule } from './meeting-schedule';
import { COURSE_CATEGORIES } from './catalog-lib';
import { ProgramPluginsField } from './program-plugins-field';

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
    <div className="space-y-3">
      <input type="hidden" name="batches" value={serialized} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950">Additional cohorts</p>
        <button
          type="button"
          onClick={() =>
            setRows((r) => [
              ...r,
              { label: '', days: [], time: '18:00', tz: 'Africa/Lagos' },
            ])
          }
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-signal-700 hover:text-signal-800"
        >
          <PiPlusBold className="h-3.5 w-3.5" aria-hidden />
          Add cohort
        </button>
      </div>
      <p className="text-sm text-neutral-600">
        Offer this program at more than one weekly schedule (e.g. Morning Cohort vs
        Evening Cohort). All cohorts share the same curriculum and interactive tools.
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
              placeholder="Cohort label (e.g. Morning Cohort or Evening Cohort)"
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

/** The browser's IANA timezone (e.g. "Africa/Lagos"), or Lagos as a fallback. */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  } catch {
    return 'Africa/Lagos';
  }
}

/** "Lagos (GMT+1)" — city + current offset, so a wrong zone is obvious. */
function tzLabel(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    return offset ? `${city} (${offset})` : city;
  } catch {
    return city;
  }
}

/** Create-program form (used inside the New program modal on /courses). */
export function NewProgramForm() {
  const [state, action] = useActionState(createCourse, initial);
  // Default the start date to today so a program created to run now actually has
  // an occurrence today — without a start date the schedule yields zero sessions
  // and "Join"/"Go live" stays disabled from the first render. The admin can
  // still push it to a future start.
  const today = todayLocal();
  // Default the timezone to the creator's own zone so meeting times line up with
  // their clock. The reported bug: a time picked in local wall-clock while the
  // program sat on a different GMT offset slid the join window hours away, so
  // "Join" looked broken. SSR-safe default (Lagos), swapped to the detected zone
  // on mount; the offset is shown in the label so a wrong zone is obvious.
  const [timezone, setTimezone] = useState('Africa/Lagos');
  useEffect(() => {
    const updateTimezone = setTimeout(() => setTimezone(detectTimezone()), 0);
    return () => clearTimeout(updateTimezone);
  }, []);
  const tzOptions = useMemo(
    () => (TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]),
    [timezone],
  );
  return (
    <form action={action} className="space-y-8">
      <FormError message={state.error} />

      <section>
        <div className="mb-5">
          <h3 className="text-lg font-bold tracking-tight text-neutral-950">Program details</h3>
          <p className="mt-1 text-sm text-neutral-600">Give learners enough context to decide whether this program is right for them.</p>
        </div>
        <div className="space-y-4">
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
              rows={4}
              placeholder="What will students learn, and who is it for?"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="level" className={labelClass}>
                Level
              </label>
              <select id="level" name="level" defaultValue="" className={inputClass}>
                <option value="">Choose a level</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-7">
        <div className="mb-5">
          <h3 className="text-lg font-bold tracking-tight text-neutral-950">
            Classroom capabilities
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Equip this program with specialized interactive teaching tools.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <ProgramPluginsField />
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-7">
        <div className="mb-5">
          <h3 className="text-lg font-bold tracking-tight text-neutral-950">Cohort schedule</h3>
          <p className="mt-1 text-sm text-neutral-600">Choose when this cohort starts and when the class meets each week.</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <DurationField defaultWeeks={8} defaultStartDate={today} />

          <div className="mt-6 border-t border-neutral-200 pt-5">
            <MeetingSchedule />
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-5">
            <label htmlFor="timezone" className={labelClass}>
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={`${inputClass} mt-1.5`}
            >
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tzLabel(tz)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-neutral-600">
              Class times use this timezone. It defaults to your current location.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-7">
        <div className="mb-5">
          <h3 className="text-lg font-bold tracking-tight text-neutral-950">
            Cohorts &amp; Schedules (Optional)
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Offer the same program at multiple weekly timeslots or intake dates. You can also add more cohorts later.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <BatchRows timezones={TIMEZONES} />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-[#f4f6f3]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Creating…">
            Create program
          </SubmitButton>
          <p className="mt-2 text-xs text-neutral-600">
            You can assign an instructor, schedule live sessions, and add curriculum after creation.
          </p>
        </div>
      </div>
    </form>
  );
}
