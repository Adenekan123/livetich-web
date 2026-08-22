'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { PiPencilSimple } from 'react-icons/pi';
import { updateCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { btn, inputClass, labelClass } from '@/lib/ui';
import type { CourseDetail } from '@/lib/types';

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

/** ISO datetime → the "YYYY-MM-DD" a <input type="date"> expects. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * "Edit program" button + modal for the owning admin (and assigned instructor).
 * Pre-fills every field from the current course — including the cohort schedule
 * (meeting days, time, timezone) — and closes once the update lands.
 */
export function EditProgramButton({ course }: { course: CourseDetail }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateCourse, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const days = course.meetingDays ?? [];
  const durationInList = DURATIONS.some((d) => d.w === course.durationWeeks);
  const tzInList = !course.timezone || TIMEZONES.includes(course.timezone);

  // Close once the edit is saved (deferred a tick so it isn't a sync setState).
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={btn('secondary', 'sm')}
      >
        <PiPencilSimple className="h-4 w-4" aria-hidden />
        Edit program
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit program"
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                Edit program
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            <form ref={formRef} action={action} className="mt-4 space-y-4">
              <FormError message={state.error} />
              <input type="hidden" name="courseId" value={course.id} />

              <div className="space-y-1.5">
                <label htmlFor="edit-title" className={labelClass}>
                  Program title
                </label>
                <input
                  id="edit-title"
                  name="title"
                  required
                  defaultValue={course.title}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-description" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="edit-description"
                  name="description"
                  rows={3}
                  defaultValue={course.description ?? ''}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-category" className={labelClass}>
                    Category
                  </label>
                  <input
                    id="edit-category"
                    name="category"
                    list="edit-course-categories"
                    defaultValue={course.category ?? ''}
                    className={inputClass}
                  />
                  <datalist id="edit-course-categories">
                    <option value="Software Engineering" />
                    <option value="Design" />
                    <option value="Business" />
                    <option value="Data" />
                    <option value="Languages" />
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-level" className={labelClass}>
                    Level
                  </label>
                  <select
                    id="edit-level"
                    name="level"
                    defaultValue={course.level ?? ''}
                    className={inputClass}
                  >
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
                    <label htmlFor="edit-startDate" className={labelClass}>
                      Start date
                    </label>
                    <input
                      id="edit-startDate"
                      name="startDate"
                      type="date"
                      defaultValue={toDateInput(course.startDate)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="edit-durationWeeks" className={labelClass}>
                      Duration
                    </label>
                    <select
                      id="edit-durationWeeks"
                      name="durationWeeks"
                      defaultValue={course.durationWeeks ?? 8}
                      className={inputClass}
                    >
                      {!durationInList && course.durationWeeks != null && (
                        <option value={course.durationWeeks}>
                          {course.durationWeeks} weeks
                        </option>
                      )}
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
                        <input
                          type="checkbox"
                          name="meetingDays"
                          value={i}
                          defaultChecked={days.includes(i)}
                          className="peer sr-only"
                        />
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium text-neutral-600 transition hover:border-neutral-500 peer-checked:border-signal-700 peer-checked:bg-signal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-signal-400 peer-focus-visible:ring-offset-1">
                          {d}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="edit-meetingTime" className={labelClass}>
                      Start time
                    </label>
                    <input
                      id="edit-meetingTime"
                      name="meetingTime"
                      type="time"
                      defaultValue={course.meetingTime ?? '18:00'}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="edit-timezone" className={labelClass}>
                      Timezone
                    </label>
                    <select
                      id="edit-timezone"
                      name="timezone"
                      defaultValue={course.timezone ?? 'Africa/Lagos'}
                      className={inputClass}
                    >
                      {!tzInList && course.timezone && (
                        <option value={course.timezone}>{course.timezone}</option>
                      )}
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.split('/').pop()?.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Changing the days or time reschedules upcoming sessions and
                  prompts enrolled students to re-add their reminder.
                </p>
              </div>

              <SubmitButton className="w-full" pendingLabel="Saving…">
                Save changes
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
