'use client';

import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { inputClass, labelClass } from '@/lib/ui';

function toDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

function toValue(date: Date): string {
  const part = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

export function DatePicker({
  id,
  name,
  label,
  value,
  onChange,
  min,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => toDate(value), [value]);
  const minDate = useMemo(() => toDate(min ?? ''), [min]);

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex min-h-11 items-center justify-between text-left`}
      >
        <span>{selected ? selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select a date'}</span>
        <span aria-hidden className="text-signal-700">Calendar</span>
      </button>
      {open && (
        <div role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className="absolute left-0 top-full z-20 mt-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
          <DayPicker
            mode="single"
            selected={selected}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(date) => {
              if (!date) return;
              onChange(toValue(date));
              setOpen(false);
            }}
            classNames={{
              root: 'text-sm',
              month_caption: 'mb-3 text-center font-semibold text-neutral-950',
              nav: 'flex items-center justify-between',
              button_previous: 'rounded-lg p-2 text-signal-700 hover:bg-signal-50',
              button_next: 'rounded-lg p-2 text-signal-700 hover:bg-signal-50',
              month_grid: 'w-full border-collapse',
              weekday: 'p-1 text-xs font-medium text-neutral-500',
              day: 'p-0.5',
              day_button: 'grid h-9 w-9 place-items-center rounded-lg text-sm text-neutral-700 hover:bg-signal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-600',
              selected: '[&>button]:bg-signal-700 [&>button]:text-white [&>button]:hover:bg-signal-800',
              today: '[&>button]:font-bold [&>button]:text-signal-800',
              disabled: '[&>button]:cursor-not-allowed [&>button]:text-neutral-300 [&>button]:hover:bg-transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}
