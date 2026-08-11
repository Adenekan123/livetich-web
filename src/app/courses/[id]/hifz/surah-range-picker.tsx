'use client';

import { inputClass } from '@/lib/ui';
import type { Surah } from '@/lib/types';

export interface RangeValue {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
}

/**
 * Surah dropdown + start/end ayah inputs, clamped to the chosen surah's real
 * ayah count. Picking a surah defaults the range to the whole surah. Controlled.
 */
export function SurahRangePicker({
  surahs,
  value,
  onChange,
}: {
  surahs: Surah[];
  value: RangeValue;
  onChange: (next: RangeValue) => void;
}) {
  const surah = surahs.find((s) => s.number === value.surahNumber);
  const max = surah?.ayahCount ?? 1;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
      <select
        value={value.surahNumber}
        onChange={(e) => {
          const n = Number(e.target.value);
          const s = surahs.find((x) => x.number === n);
          // Default to the whole surah when the surah changes.
          onChange({ surahNumber: n, ayahStart: 1, ayahEnd: s?.ayahCount ?? 1 });
        }}
        aria-label="Surah"
        className={inputClass}
      >
        {surahs.map((s) => (
          <option key={s.number} value={s.number}>
            {s.number}. {s.transliteration} ({s.ayahCount})
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-neutral-500">
        <span className="sr-only sm:not-sr-only">Ayah</span>
        <input
          type="number"
          min={1}
          max={max}
          value={value.ayahStart}
          onChange={(e) =>
            onChange({ ...value, ayahStart: clamp(e.target.value, 1, max) })
          }
          aria-label="Start ayah"
          className={`${inputClass} w-20`}
        />
      </label>
      <label className="flex items-center gap-1.5 text-sm text-neutral-500">
        <span aria-hidden>–</span>
        <input
          type="number"
          min={1}
          max={max}
          value={value.ayahEnd}
          onChange={(e) =>
            onChange({ ...value, ayahEnd: clamp(e.target.value, 1, max) })
          }
          aria-label="End ayah"
          className={`${inputClass} w-20`}
        />
      </label>
    </div>
  );
}

function clamp(raw: string, lo: number, hi: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
