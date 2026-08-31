'use client';

import { useState, useTransition } from 'react';
import { updateOrgSettings } from '@/app/actions/org';
import { btn, inputClass, labelClass } from '@/lib/ui';
import type { OrgSettings } from '@/lib/types';

/** One labelled toggle row (a styled checkbox), controlled by the parent. */
function Toggle({
  name,
  title,
  desc,
  checked,
  onChange,
}: {
  name: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-signal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-signal-400 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/**
 * Admin form for org-wide class preferences. State lives here and is saved via a
 * transition (not a <form action>, which React auto-resets after submit and
 * would visually snap the toggles back to their old values).
 */
export function PreferencesForm({ settings }: { settings: OrgSettings }) {
  const [evict, setEvict] = useState(settings.evictOnInstructorLeave);
  const [mic, setMic] = useState(settings.micRequiresRaisedHand);
  const [reminder, setReminder] = useState(settings.preClassReminder);
  const [lead, setLead] = useState(String(settings.reminderLeadMinutes));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateOrgSettings({
        evictOnInstructorLeave: evict,
        micRequiresRaisedHand: mic,
        preClassReminder: reminder,
        reminderLeadMinutes: Number(lead) || 30,
      });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="divide-y divide-neutral-100">
        <Toggle
          name="evictOnInstructorLeave"
          title="Remove students when class ends"
          desc="When the instructor ends the class, students are returned to the program page instead of staying on the board."
          checked={evict}
          onChange={(v) => {
            setSaved(false);
            setEvict(v);
          }}
        />
        <Toggle
          name="micRequiresRaisedHand"
          title="Mic only with a raised hand"
          desc="A student can be given the mic only while their hand is raised; lowering it mutes them again."
          checked={mic}
          onChange={(v) => {
            setSaved(false);
            setMic(v);
          }}
        />
        <Toggle
          name="preClassReminder"
          title="Email students before class"
          desc="Send enrolled students an email reminder ahead of each class occurrence."
          checked={reminder}
          onChange={(v) => {
            setSaved(false);
            setReminder(v);
          }}
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
            value={lead}
            onChange={(e) => {
              setSaved(false);
              setLead(e.target.value);
            }}
            className={`${inputClass} w-24`}
          />
          <span className="text-sm text-neutral-500">minutes before start</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={btn('primary')}
        >
          {pending ? 'Saving…' : 'Save preferences'}
        </button>
        {saved && (
          <span className="text-sm font-medium text-signal-700">Saved ✓</span>
        )}
      </div>
    </div>
  );
}
