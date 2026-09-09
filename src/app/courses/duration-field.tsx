'use client';

import { useMemo, useState } from 'react';
import { cn, inputClass, labelClass } from '@/lib/ui';
import { DatePicker } from './date-picker';

const DURATIONS = [
  { w: 4, label: '4 weeks (1 month)' },
  { w: 6, label: '6 weeks' },
  { w: 8, label: '8 weeks (2 months)' },
  { w: 12, label: '12 weeks (3 months)' },
];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Start date + duration for the create / edit program forms. Duration can be set
 * two ways: a preset **length** (weeks) or a custom **end date** that we convert
 * to whole weeks — the cohort model still runs on `durationWeeks`, so the picked
 * date rounds to the nearest week and sessions land on the meeting days within
 * that span. Emits `startDate` and `durationWeeks` for the server action.
 */
export function DurationField({
  idPrefix = '',
  defaultStartDate = '',
  defaultWeeks = 8,
}: {
  idPrefix?: string;
  defaultStartDate?: string;
  defaultWeeks?: number;
}) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [mode, setMode] = useState<'length' | 'date'>('length');
  const [weeks, setWeeks] = useState(String(defaultWeeks));
  const [endDate, setEndDate] = useState('');

  const durationInList = DURATIONS.some((d) => d.w === defaultWeeks);

  const computedWeeks = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
    return Math.max(1, Math.round((e - s) / MS_PER_WEEK));
  }, [startDate, endDate]);

  return (
    <>
      <fieldset>
        <legend className={labelClass}>Schedule length</legend>
        <div className="mt-1.5 inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs font-semibold">
          {(['length', 'date'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'rounded-md px-3 py-1.5 transition',
                mode === m
                  ? 'bg-signal-700 text-white'
                  : 'text-neutral-600 hover:bg-signal-50 hover:text-signal-800',
              )}
            >
              {m === 'length' ? 'Set duration' : 'Set end date'}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DatePicker
          id={`${idPrefix}startDate`}
          name="startDate"
          label="Start date"
          value={startDate}
          onChange={setStartDate}
        />
        <div className="space-y-1.5">
          {mode === 'length' ? (
            <>
              <label htmlFor={`${idPrefix}durationWeeks`} className={labelClass}>
                Program length
              </label>
              <select
                id={`${idPrefix}durationWeeks`}
                name="durationWeeks"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className={inputClass}
              >
                {!durationInList && (
                  <option value={defaultWeeks}>{defaultWeeks} weeks</option>
                )}
                {DURATIONS.map((d) => (
                  <option key={d.w} value={d.w}>
                    {d.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <DatePicker
              id={`${idPrefix}endDate`}
              label="End date"
              value={endDate}
              min={startDate || undefined}
              onChange={setEndDate}
            />
          )}
        </div>
      </div>
      {mode === 'date' && (
        <>
          {/* The cohort still runs on whole weeks; empty submits nothing, which
              the action treats as "no change" (edit) / default (create). */}
          <input type="hidden" name="durationWeeks" value={computedWeeks ?? ''} />
          <p className="mt-1.5 text-xs text-neutral-400">
            {computedWeeks
              ? `Runs about ${computedWeeks} ${computedWeeks === 1 ? 'week' : 'weeks'} — sessions land on the meeting days within that span.`
              : 'Pick an end date after the start date.'}
          </p>
        </>
      )}
    </>
  );
}
