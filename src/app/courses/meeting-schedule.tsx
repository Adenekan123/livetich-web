'use client';

import { useState } from 'react';
import { inputClass, labelClass } from '@/lib/ui';

const SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; // index 0..6 (Sun..Sat)
const FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Meeting-day picker + time(s) for a program's weekly cadence. Two modes: one
 * general time for every day, or a per-day time (some days can meet at a
 * different hour). Renders hidden inputs the server actions already read —
 * `meetingDays` (one per selected day), `meetingTime` (the general/fallback
 * time), and `meetingTimesByDay` (a JSON map of day→"HH:mm") — so it drops into
 * any <form action> without new plumbing. Used by both the create and edit
 * program forms.
 */
export function MeetingSchedule({
  defaultDays = [],
  defaultTime = '18:00',
  defaultPerDay = {},
  idPrefix = '',
}: {
  defaultDays?: number[];
  defaultTime?: string;
  defaultPerDay?: Record<string, string>;
  /** Prefix for element ids so two instances on a page don't collide. */
  idPrefix?: string;
}) {
  const [days, setDays] = useState<number[]>(
    [...defaultDays].sort((a, b) => a - b),
  );
  const [time, setTime] = useState(defaultTime || '18:00');
  const [perDay, setPerDay] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const [k, v] of Object.entries(defaultPerDay)) m[Number(k)] = v;
    return m;
  });
  const [perDayOn, setPerDayOn] = useState(
    Object.keys(defaultPerDay).length > 0,
  );

  const toggleDay = (d: number) =>
    setDays((ds) =>
      ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b),
    );

  // Only selected days that carry an explicit time go into the map; the rest
  // fall back to the general time server-side. Off = no overrides at all.
  const perDayPayload = perDayOn
    ? Object.fromEntries(
        days.filter((d) => perDay[d]).map((d) => [String(d), perDay[d]]),
      )
    : {};

  return (
    <div className="space-y-3">
      {/* Hidden fields the create/update actions read from FormData. */}
      {days.map((d) => (
        <input key={d} type="hidden" name="meetingDays" value={d} />
      ))}
      <input type="hidden" name="meetingTime" value={time} />
      <input
        type="hidden"
        name="meetingTimesByDay"
        value={JSON.stringify(perDayPayload)}
      />

      <div className="space-y-1.5">
        <span className={labelClass}>Meeting days</span>
        <div className="flex flex-wrap gap-1.5">
          {SHORT.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              aria-pressed={days.includes(i)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition ${
                days.includes(i)
                  ? 'border-signal-700 bg-signal-700 text-white'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={perDayOn}
          onChange={(e) => setPerDayOn(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-signal-700 focus:ring-signal-400"
        />
        Set a different time for each day
      </label>

      {!perDayOn ? (
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}meetingTime`} className={labelClass}>
            Start time
          </label>
          <input
            id={`${idPrefix}meetingTime`}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={`${inputClass} w-40`}
          />
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
          {days.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Pick meeting days above, then set each day&apos;s time here.
            </p>
          ) : (
            <>
              {days.map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium text-neutral-700">
                    {FULL[d]}
                  </span>
                  <input
                    type="time"
                    value={perDay[d] ?? time}
                    onChange={(e) =>
                      setPerDay((p) => ({ ...p, [d]: e.target.value }))
                    }
                    className={`${inputClass} w-40`}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-neutral-200 pt-2">
                <span className="w-24 text-xs text-neutral-500">
                  Default time
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`${inputClass} w-40`}
                />
              </div>
              <p className="text-xs text-neutral-400">
                Set each day&apos;s time above. Any day you don&apos;t change
                falls back to the default time.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
