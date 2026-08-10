'use client';

import { useState, useTransition } from 'react';
import { recordReminderAdded } from '@/app/actions/courses';
import { btn, cardClass, cn } from '@/lib/ui';

/**
 * Lets an enrolled student add the class series to their device calendar (a
 * recurring .ics with a 15-min alarm). We can't detect a real "Add", so this
 * tracks the tap as a proxy; if the schedule later changes it goes stale and
 * nudges a re-add. Cross-platform incl. iOS (the .ics carries the alarm).
 */
export function ClassReminderCard({
  courseId,
  cadence,
  reminderAddedAt,
  scheduleUpdatedAt,
}: {
  courseId: string;
  cadence: string | null;
  reminderAddedAt: string | null;
  scheduleUpdatedAt: string | null;
}) {
  const current =
    !!reminderAddedAt &&
    (!scheduleUpdatedAt ||
      new Date(reminderAddedAt) >= new Date(scheduleUpdatedAt));
  const stale = !!reminderAddedAt && !current;

  const [pending, start] = useTransition();
  const [done, setDone] = useState(current);
  const [staleNow, setStaleNow] = useState(stale);

  function addToCalendar() {
    start(async () => {
      await recordReminderAdded(courseId);
      // Trigger the .ics download (opens the calendar app on mobile).
      const a = document.createElement('a');
      a.href = `/api/courses/${courseId}/calendar`;
      a.download = 'livetich-class.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDone(true);
      setStaleNow(false);
    });
  }

  const steps = (
    <p className="mt-2 text-xs leading-relaxed text-neutral-500">
      Your calendar opens — tap <span className="font-semibold">Add</span> to save
      the series. On iPhone it saves to Apple Calendar and reminds you
      automatically.
    </p>
  );

  const addButton = (
    <button
      onClick={addToCalendar}
      disabled={pending}
      className={cn(btn('primary', 'sm'), 'shrink-0')}
    >
      {pending ? 'Opening…' : '📅 Add to calendar'}
    </button>
  );

  // Schedule changed after they'd added — nudge a re-add.
  if (staleNow) {
    return (
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              The class time changed
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              Your reminder is out of date — re-add it to be reminded at the new
              time.
            </p>
          </div>
          {addButton}
        </div>
        {steps}
      </div>
    );
  }

  // Already added and current.
  if (done) {
    return (
      <div className={cn(cardClass, 'mt-3 flex flex-wrap items-center justify-between gap-3 p-5')}>
        <p className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <span className="text-emerald-600">✓</span> Reminder set — you&apos;ll be
          reminded 15 min before class.
        </p>
        <button
          onClick={addToCalendar}
          disabled={pending}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          {pending ? 'Opening…' : "Didn't work? Re-add"}
        </button>
      </div>
    );
  }

  // First time — prompt to set it.
  return (
    <div className={cn(cardClass, 'mt-3 p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            Never miss a class
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            We&apos;ll remind you 15 minutes before
            {cadence ? ` — ${cadence}` : ' each session'}.
          </p>
        </div>
        {addButton}
      </div>
      {steps}
    </div>
  );
}
