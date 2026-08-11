'use client';

import { useState, useTransition } from 'react';
import {
  PiCaretDown,
  PiPlus,
  PiTrash,
  PiMicrophoneStage,
} from 'react-icons/pi';
import {
  createHifzTarget,
  deleteHifzEntry,
  deleteHifzTarget,
  logHifzEntry,
  type EntryInput,
  type TargetInput,
} from '@/app/actions/hifz';
import { formatRef, surahIndex } from '@/lib/quran';
import type {
  HifzKind,
  HifzOverviewRow,
  Surah,
} from '@/lib/types';
import { btn, cardClass, cn } from '@/lib/ui';
import { KindBadge, ProgressMeter, Rating } from './hifz-ui';
import { SurahRangePicker, type RangeValue } from './surah-range-picker';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function HifzManager({
  courseId,
  rows,
  surahs,
  totalAyahs,
}: {
  courseId: string;
  rows: HifzOverviewRow[];
  surahs: Surah[];
  totalAyahs: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const index = surahIndex(surahs);

  function act(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
        No students are enrolled yet. Once students join this class, set each a
        memorization target here.
      </p>
    );
  }

  return (
    <section className="mt-8">
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <StudentCard
            key={row.student.id}
            row={row}
            surahs={surahs}
            index={index}
            totalAyahs={totalAyahs}
            expanded={open === row.student.id}
            pending={pending}
            onToggle={() =>
              setOpen((cur) => (cur === row.student.id ? null : row.student.id))
            }
            onAddTarget={(input) => act(() => createHifzTarget(courseId, input))}
            onDeleteTarget={(id) => act(() => deleteHifzTarget(courseId, id))}
            onLogEntry={(input) => act(() => logHifzEntry(courseId, input))}
            onDeleteEntry={(id) => act(() => deleteHifzEntry(courseId, id))}
          />
        ))}
      </div>
    </section>
  );
}

function StudentCard({
  row,
  surahs,
  index,
  totalAyahs,
  expanded,
  pending,
  onToggle,
  onAddTarget,
  onDeleteTarget,
  onLogEntry,
  onDeleteEntry,
}: {
  row: HifzOverviewRow;
  surahs: Surah[];
  index: Map<number, Surah>;
  totalAyahs: number;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onAddTarget: (input: TargetInput) => void;
  onDeleteTarget: (id: string) => void;
  onLogEntry: (input: EntryInput) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const { student, targets, entries, progress } = row;

  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      {/* Header row (click to expand) */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-neutral-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-950">{student.name}</p>
          <p className="truncate text-xs text-neutral-400">{student.email}</p>
        </div>
        <div className="hidden w-56 shrink-0 sm:block">
          <ProgressMeter progress={progress} totalAyahs={totalAyahs} />
        </div>
        <span className="shrink-0 text-xs text-neutral-400">
          {targets.length} target{targets.length === 1 ? '' : 's'}
        </span>
        <PiCaretDown
          className={cn(
            'h-4 w-4 shrink-0 text-neutral-400 transition',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-5 py-5">
          <div className="sm:hidden">
            <ProgressMeter progress={progress} totalAyahs={totalAyahs} />
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {/* Targets */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Targets
              </h3>
              {targets.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">None yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {targets.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-950">
                          {formatRef(index, t.surahNumber, t.ayahStart, t.ayahEnd)}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : 'No due date'}
                        </p>
                        {t.note && (
                          <p className="mt-1 text-sm text-neutral-600">{t.note}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteTarget(t.id)}
                        disabled={pending}
                        aria-label="Remove target"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <TargetForm
                surahs={surahs}
                pending={pending}
                onSubmit={(input) => onAddTarget({ ...input, studentId: student.id })}
              />
            </div>

            {/* Recitation log */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Recitation log
              </h3>
              {entries.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">Nothing logged yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-neutral-100">
                  {entries.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-start gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-950">
                            {formatRef(index, e.surahNumber, e.ayahStart, e.ayahEnd)}
                          </span>
                          <KindBadge kind={e.kind} />
                          <Rating value={e.rating} />
                        </div>
                        {e.tajweed && (
                          <p className="mt-1 text-sm text-neutral-600">{e.tajweed}</p>
                        )}
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {fmtDate(e.recordedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => onDeleteEntry(e.id)}
                        disabled={pending}
                        aria-label="Remove entry"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <EntryForm
                surahs={surahs}
                pending={pending}
                onSubmit={(input) => onLogEntry({ ...input, studentId: student.id })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Default a fresh picker to Al-Fatihah (whole surah). */
function defaultRange(surahs: Surah[]): RangeValue {
  const s = surahs[0];
  return { surahNumber: s?.number ?? 1, ayahStart: 1, ayahEnd: s?.ayahCount ?? 7 };
}

function TargetForm({
  surahs,
  pending,
  onSubmit,
}: {
  surahs: Surah[];
  pending: boolean;
  onSubmit: (input: Omit<TargetInput, 'studentId'>) => void;
}) {
  const [range, setRange] = useState<RangeValue>(() => defaultRange(surahs));
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...range, dueAt: dueAt || null, note: note.trim() || null });
        setNote('');
      }}
      className="mt-3 rounded-xl border border-dashed border-neutral-300 p-3"
    >
      <p className="mb-2 text-xs font-semibold text-neutral-500">Assign a target</p>
      <SurahRangePicker surahs={surahs} value={range} onChange={setRange} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Due date (optional)
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. focus on tajweed"
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className={cn(btn('secondary', 'sm'), 'mt-3')}
      >
        <PiPlus className="h-4 w-4" /> Assign target
      </button>
    </form>
  );
}

function EntryForm({
  surahs,
  pending,
  onSubmit,
}: {
  surahs: Surah[];
  pending: boolean;
  onSubmit: (input: Omit<EntryInput, 'studentId'>) => void;
}) {
  const [range, setRange] = useState<RangeValue>(() => defaultRange(surahs));
  const [kind, setKind] = useState<HifzKind>('NEW_HIFZ');
  const [rating, setRating] = useState('');
  const [tajweed, setTajweed] = useState('');

  const field =
    'mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...range,
          kind,
          rating: rating ? Number(rating) : null,
          tajweed: tajweed.trim() || null,
        });
        setTajweed('');
        setRating('');
      }}
      className="mt-3 rounded-xl border border-dashed border-neutral-300 p-3"
    >
      <p className="mb-2 text-xs font-semibold text-neutral-500">Log a recitation</p>
      <SurahRangePicker surahs={surahs} value={range} onChange={setRange} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as HifzKind)}
            className={field}
          >
            <option value="NEW_HIFZ">New memorization</option>
            <option value="REVISION">Revision (muraja&apos;ah)</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Rating (optional)
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className={field}
          >
            <option value="">Not rated</option>
            <option value="1">1 — needs work</option>
            <option value="2">2</option>
            <option value="3">3 — good</option>
            <option value="4">4</option>
            <option value="5">5 — mastered</option>
          </select>
        </label>
      </div>
      <label className="mt-2 block text-xs text-neutral-500">
        Tajweed notes (optional)
        <input
          value={tajweed}
          onChange={(e) => setTajweed(e.target.value)}
          maxLength={1000}
          placeholder="e.g. lengthen the madd in ayah 3"
          className={field}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={cn(btn('secondary', 'sm'), 'mt-3')}
      >
        <PiMicrophoneStage className="h-4 w-4" /> Log recitation
      </button>
    </form>
  );
}
