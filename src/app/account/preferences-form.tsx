'use client';

import { useActionState, useState } from 'react';
import { updateOrgSettings, type OrgActionState } from '@/app/actions/org';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';
import type { OrgSettings } from '@/lib/types';

const initial: OrgActionState = { error: null };

/** One labelled toggle row (a styled checkbox). */
function Toggle({
  name,
  title,
  desc,
  defaultChecked,
}: {
  name: string;
  title: string;
  desc: string;
  defaultChecked: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-950">{title}</span>
        <span className="mt-0.5 block text-sm text-neutral-500">{desc}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          name={name}
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-signal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-signal-400 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Admin form for org-wide class preferences. */
export function PreferencesForm({ settings }: { settings: OrgSettings }) {
  const [state, action] = useActionState(updateOrgSettings, initial);
  return (
    <form action={action} className="space-y-2">
      <FormError message={state.error} />

      <div className="divide-y divide-neutral-100">
        <Toggle
          name="evictOnInstructorLeave"
          title="Remove students when class ends"
          desc="When the instructor ends the class, students are returned to the program page instead of staying on the board."
          defaultChecked={settings.evictOnInstructorLeave}
        />
        <Toggle
          name="micRequiresRaisedHand"
          title="Mic only with a raised hand"
          desc="A student can be given the mic only while their hand is raised; lowering it mutes them again."
          defaultChecked={settings.micRequiresRaisedHand}
        />
        <Toggle
          name="preClassReminder"
          title="Email students before class"
          desc="Send enrolled students an email reminder ahead of each class occurrence."
          defaultChecked={settings.preClassReminder}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
        <label htmlFor="reminderLeadMinutes" className={labelClass}>
          Reminder lead time
        </label>
        <div className="flex items-center gap-2">
          <input
            id="reminderLeadMinutes"
            name="reminderLeadMinutes"
            type="number"
            min={5}
            max={1440}
            step={5}
            defaultValue={settings.reminderLeadMinutes}
            className={`${inputClass} w-24`}
          />
          <span className="text-sm text-neutral-500">minutes before start</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
        {state.ok && !state.error && (
          <span className="text-sm font-medium text-signal-700">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
