'use client';

import { formatRef, surahIndex } from '@/lib/quran';
import type { MyHifz, Surah } from '@/lib/types';
import { cardClass, cn } from '@/lib/ui';
import { KindBadge, ProgressMeter, Rating } from './hifz-ui';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** A student's own memorization view: progress, assigned targets, recitation log. */
export function MyHifzPanel({
  mine,
  surahs,
  totalAyahs,
}: {
  mine: MyHifz;
  surahs: Surah[];
  totalAyahs: number;
}) {
  const index = surahIndex(surahs);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* Progress + targets */}
      <div className="space-y-6">
        <div className={cn(cardClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">Your progress</h2>
          <div className="mt-3">
            <ProgressMeter progress={mine.progress} totalAyahs={totalAyahs} />
          </div>
          {mine.progress.lastRecitedAt && (
            <p className="mt-3 text-xs text-neutral-400">
              Last recitation {fmtDate(mine.progress.lastRecitedAt)}
            </p>
          )}
        </div>

        <div className={cn(cardClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">Your targets</h2>
          {mine.targets.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">
              No memorization targets set yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mine.targets.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-neutral-200 px-3.5 py-3"
                >
                  <p className="text-sm font-semibold text-neutral-950">
                    {formatRef(index, t.surahNumber, t.ayahStart, t.ayahEnd)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : 'No due date'}
                  </p>
                  {t.note && (
                    <p className="mt-1.5 text-sm text-neutral-600">{t.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recitation log */}
      <div className={cn(cardClass, 'p-5')}>
        <h2 className="text-sm font-semibold text-neutral-900">Recitation log</h2>
        {mine.entries.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No recitations logged yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {mine.entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-950">
                      {formatRef(index, e.surahNumber, e.ayahStart, e.ayahEnd)}
                    </span>
                    <KindBadge kind={e.kind} />
                  </div>
                  {e.tajweed && (
                    <p className="mt-1 text-sm text-neutral-600">{e.tajweed}</p>
                  )}
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {fmtDate(e.recordedAt)}
                  </p>
                </div>
                <Rating value={e.rating} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
