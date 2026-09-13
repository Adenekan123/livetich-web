'use client';

import { PiCheck } from 'react-icons/pi';
import {
  ayahsDoneInTarget,
  formatRef,
  surahIndex,
  targetLength,
} from '@/lib/quran';
import type { HifzEntry, HifzTarget, MyHifz, Surah } from '@/lib/types';
import { cardClass, cn } from '@/lib/ui';
import { KindBadge, Rating } from './hifz-ui';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * One target with how far through it the student is.
 *
 * Measured against the target rather than against the whole Qur'an, which is
 * the number that actually moves week to week. A beginner's bar against all
 * 6,236 ayahs is empty for months, and an empty bar is not encouragement.
 */
function TargetCard({
  target,
  entries,
  index,
}: {
  target: HifzTarget;
  entries: HifzEntry[];
  index: Map<number, Surah>;
}) {
  const done = ayahsDoneInTarget(entries, target);
  const total = targetLength(target);
  const complete = total > 0 && done >= total;

  return (
    <li className="rounded-xl border border-neutral-200 px-3.5 py-3">
      <p className="text-sm font-semibold text-neutral-950">
        {formatRef(index, target.surahNumber, target.ayahStart, target.ayahEnd)}
      </p>
      <div className="mt-2 flex items-center gap-2.5">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"
          role="img"
          aria-label={`${done} of ${total} ayahs memorized`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              complete ? 'bg-emerald-600' : 'bg-signal-600',
            )}
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            complete ? 'text-emerald-700' : 'text-neutral-600',
          )}
        >
          {complete ? (
            <span className="inline-flex items-center gap-1">
              <PiCheck className="h-3.5 w-3.5" aria-hidden />
              done
            </span>
          ) : (
            `${done} of ${total} ayahs`
          )}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        {target.dueAt ? `Due ${fmtDate(target.dueAt)}` : 'No due date'}
      </p>
      {target.note && (
        <p className="mt-1.5 text-sm text-neutral-600">{target.note}</p>
      )}
    </li>
  );
}

/** A student's own memorization view: what they are on, and how it has gone. */
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
      <div className="space-y-6">
        <div className={cn(cardClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">
            What you are memorizing
          </h2>
          {mine.targets.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">
              Nothing set yet — your teacher will choose what you memorize next,
              and it will appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mine.targets.map((t) => (
                <TargetCard
                  key={t.id}
                  target={t}
                  entries={mine.entries}
                  index={index}
                />
              ))}
            </ul>
          )}
        </div>

        <div className={cn(cardClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">Altogether</h2>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-950">
            {mine.progress.ayahsMemorized.toLocaleString()}
            <span className="ml-1.5 text-sm font-normal text-neutral-600">
              ayah{mine.progress.ayahsMemorized === 1 ? '' : 's'} memorized
            </span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            across {mine.progress.surahsTouched} surah
            {mine.progress.surahsTouched === 1 ? '' : 's'} · of{' '}
            {totalAyahs.toLocaleString()}
            {' in the Qur’an'}
          </p>
          {mine.progress.lastRecitedAt && (
            <p className="mt-3 text-xs text-neutral-500">
              Last recitation {fmtDate(mine.progress.lastRecitedAt)}
            </p>
          )}
        </div>
      </div>

      <div className={cn(cardClass, 'p-5')}>
        <h2 className="text-sm font-semibold text-neutral-900">
          What you have recited
        </h2>
        {mine.entries.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Nothing yet. After you recite to your teacher, it will be recorded
            here with their notes.
          </p>
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
                  <p className="mt-0.5 text-xs text-neutral-500">
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
