'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PiCaretDown,
  PiCheck,
  PiNotePencil,
  PiPlus,
  PiTrash,
} from 'react-icons/pi';
import {
  createHifzTarget,
  deleteHifzEntry,
  deleteHifzTarget,
  logHifzEntry,
  type EntryInput,
  type TargetInput,
} from '@/app/actions/hifz';
import { TajweedCorrectionChips } from './tajweed-chips';
import {
  ayahsDoneInTarget,
  formatRef,
  nextAyahInTarget,
  shortRef,
  surahIndex,
  targetLength,
} from '@/lib/quran';
import type {
  HifzEntry,
  HifzKind,
  HifzOverviewRow,
  HifzTarget,
  Surah,
} from '@/lib/types';
import { btn, cardClass, cn, initials, inputClass } from '@/lib/ui';
import { KindBadge, Rating } from './hifz-ui';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * `inputClass` without its `w-full`, so each field can set its own width.
 *
 * `cn` is a plain join rather than a tailwind merge, so appending `w-20` to
 * `inputClass` leaves both widths in the class list and lets stylesheet order
 * decide — which is how the ayah boxes ended up full-width.
 */
const FIELD =
  'rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15';

/**
 * "today" / "yesterday" / "4 days ago", then a plain date once that stops
 * being useful.
 *
 * A teacher deciding who to hear next is asking how long it has been, not what
 * the calendar said — and "3 days ago" answers that without the subtraction.
 */
function sinceDay(iso: string): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOf(new Date()) - startOf(new Date(iso))) / 86_400_000,
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return fmtDate(iso);
}

/** Whole days since a recitation, or null when there has never been one. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * The halaqah, as a queue rather than a spreadsheet.
 *
 * This screen used to be a sortable table of counters with two near-identical
 * forms folded inside each row — one to set a target, one to log a recitation,
 * both opening on a surah dropdown, neither saying which was which. The
 * teacher's actual question is narrower than anything a table answers: who have
 * I not heard, and what are they on?
 *
 * So the roster leads, ordered by who has waited longest, and each student
 * carries the one action that happens every session. Setting a target happens
 * about once a week, so it sits underneath rather than beside the thing it kept
 * being confused with.
 */
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
  const index = useMemo(() => surahIndex(surahs), [surahs]);

  function act(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  // Longest unheard first, never-heard before everyone. This is the order a
  // teacher works in; "most memorized first" told them nothing about what to do.
  const queue = useMemo(() => {
    const rank = (r: HifzOverviewRow) =>
      daysSince(r.progress.lastRecitedAt) ?? Number.MAX_SAFE_INTEGER;
    return [...rows].sort(
      (a, b) => rank(b) - rank(a) || a.student.name.localeCompare(b.student.name),
    );
  }, [rows]);

  const waiting = queue.filter((r) => {
    const d = daysSince(r.progress.lastRecitedAt);
    return d === null || d >= 1;
  }).length;
  const classAyahs = rows.reduce((n, r) => n + r.progress.ayahsMemorized, 0);

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 px-5 py-6 text-sm text-neutral-600">
        No students are enrolled yet. Once they join this class, each one appears
        here with their memorization target and a place to record what they
        recite.
      </p>
    );
  }

  return (
    <section className="mt-8">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[15px] font-semibold text-neutral-950">
          {waiting > 0
            ? `${waiting} not heard yet today`
            : 'Everyone has been heard today'}
          <span className="ml-2 font-normal text-neutral-500">
            of {rows.length} student{rows.length === 1 ? '' : 's'}
          </span>
        </h2>
        <p className="text-sm text-neutral-500">
          {classAyahs.toLocaleString()} ayah{classAyahs === 1 ? '' : 's'}{' '}
          memorized across the class
        </p>
      </div>

      <ul className="mt-3 space-y-3">
        {queue.map((row) => (
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
      </ul>
    </section>
  );
}

/** The target a student is on: the soonest due, else the most recently set. */
function currentTarget(targets: HifzTarget[]): HifzTarget | null {
  if (targets.length === 0) return null;
  const dated = targets.filter((t) => t.dueAt);
  if (dated.length > 0) {
    return [...dated].sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))[0];
  }
  return [...targets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
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
  const target = currentTarget(targets);
  const done = target ? ayahsDoneInTarget(entries, target) : 0;
  const total = target ? targetLength(target) : 0;
  const complete = target !== null && total > 0 && done >= total;

  return (
    <li className={cn(cardClass, expanded && 'ring-1 ring-signal-200')}>
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600"
          aria-hidden
        >
          {initials(student.name)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-neutral-950">{student.name}</h3>

          {target ? (
            <>
              <p className="mt-1 text-sm text-neutral-600">
                Working on{' '}
                <span className="font-semibold text-neutral-950">
                  {shortRef(
                    index,
                    target.surahNumber,
                    target.ayahStart,
                    target.ayahEnd,
                  )}
                </span>
                {target.dueAt && (
                  <span className="text-neutral-500">
                    {' '}
                    · due {fmtDate(target.dueAt)}
                  </span>
                )}
              </p>
              <div className="mt-2 flex max-w-sm items-center gap-2.5">
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
                      target complete
                    </span>
                  ) : (
                    `${done} of ${total} ayahs`
                  )}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">
              No target set — give them something to memorize next.
            </p>
          )}

          <p className="mt-2 text-xs text-neutral-500">
            {progress.lastRecitedAt
              ? `Last heard ${sinceDay(progress.lastRecitedAt)}`
              : 'Not heard yet'}
            {progress.ayahsMemorized > 0 &&
              ` · ${progress.ayahsMemorized} ayah${
                progress.ayahsMemorized === 1 ? '' : 's'
              } memorized in total`}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={cn(
            btn(expanded ? 'secondary' : 'primary', 'sm'),
            'shrink-0 gap-1.5',
          )}
        >
          {expanded ? (
            <>
              Close
              <PiCaretDown className="h-4 w-4 rotate-180" aria-hidden />
            </>
          ) : (
            <>
              <PiNotePencil className="h-4 w-4" aria-hidden />
              Log recitation
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 p-4 sm:p-5">
          <RecitationForm
            key={target?.id ?? 'none'}
            surahs={surahs}
            index={index}
            target={target}
            entries={entries}
            pending={pending}
            onSubmit={(input) => onLogEntry({ ...input, studentId: student.id })}
          />

          <RecentRecitations
            entries={entries}
            index={index}
            pending={pending}
            onDelete={onDeleteEntry}
          />

          <TargetSection
            targets={targets}
            surahs={surahs}
            index={index}
            pending={pending}
            totalAyahs={totalAyahs}
            memorized={progress.ayahsMemorized}
            onAdd={(input) => onAddTarget({ ...input, studentId: student.id })}
            onDelete={onDeleteTarget}
          />
        </div>
      )}
    </li>
  );
}

interface RangeValue {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
}

/**
 * Surah, then the ayahs within it — with the whole surah one press away.
 *
 * Reciting a complete surah is the ordinary case, and it used to cost three
 * inputs, the last of which required knowing how many ayahs the surah has. The
 * count is on screen now, and the button fills it in.
 */
function RangeField({
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
  const whole = value.ayahStart === 1 && value.ayahEnd === max;

  const clamp = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 1;
    return Math.min(max, Math.max(1, n));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value.surahNumber}
        onChange={(e) => {
          const n = Number(e.target.value);
          const s = surahs.find((x) => x.number === n);
          onChange({ surahNumber: n, ayahStart: 1, ayahEnd: s?.ayahCount ?? 1 });
        }}
        aria-label="Surah"
        className={cn(FIELD, 'h-[42px] min-w-[13rem] flex-1')}
      >
        {surahs.map((s) => (
          <option key={s.number} value={s.number}>
            {s.number}. {s.transliteration} — {s.ayahCount} ayahs
          </option>
        ))}
      </select>

      {/* The label belongs to the numbers, so it wraps with them rather than
          being left stranded on the end of the surah row. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">Ayahs</span>
        <input
          type="number"
          min={1}
          max={max}
          value={value.ayahStart}
          onChange={(e) =>
            onChange({ ...value, ayahStart: clamp(e.target.value) })
          }
          aria-label="First ayah"
          className={cn(FIELD, 'h-[42px] w-[4.5rem] px-2.5 text-center')}
        />
        <span aria-hidden className="text-neutral-400">
          –
        </span>
        <input
          type="number"
          min={1}
          max={max}
          value={value.ayahEnd}
          onChange={(e) => onChange({ ...value, ayahEnd: clamp(e.target.value) })}
          aria-label="Last ayah"
          className={cn(FIELD, 'h-[42px] w-[4.5rem] px-2.5 text-center')}
        />
        <button
          type="button"
          onClick={() => onChange({ ...value, ayahStart: 1, ayahEnd: max })}
          aria-pressed={whole}
          className={cn(
            'h-[42px] shrink-0 rounded-full border px-3.5 text-xs font-semibold transition',
            whole
              ? 'border-signal-600 bg-signal-50 text-signal-700'
              : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900',
          )}
        >
          Whole surah
        </button>
      </div>
    </div>
  );
}

const RATINGS = [
  { value: 1, label: 'Needs work' },
  { value: 2, label: 'Shaky' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Strong' },
  { value: 5, label: 'Mastered' },
];

/** The 1–5 rating as five named choices rather than a numbered dropdown. */
function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="How it went">
      {RATINGS.map((r) => {
        const on = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(on ? null : r.value)}
            aria-pressed={on}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition',
              on
                ? 'border-signal-600 bg-signal-600 text-white'
                : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50',
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

const KINDS: { value: HifzKind; label: string; hint: string }[] = [
  {
    value: 'NEW_HIFZ',
    label: 'New memorization',
    hint: 'First time learning these ayahs — this is what moves their progress.',
  },
  {
    value: 'REVISION',
    label: "Revision (muraja'ah)",
    hint: 'Going back over ayahs they already know, to keep them firm.',
  },
];

/**
 * The one thing that happens every session.
 *
 * Opens on the student's own place — their current target's surah, starting at
 * the first ayah they have not been heard on — so an ordinary sitting is
 * confirm, rate, save. The old form opened on Al-Fatihah for every student
 * regardless of what they were working on.
 */
function RecitationForm({
  surahs,
  index,
  target,
  entries,
  pending,
  onSubmit,
}: {
  surahs: Surah[];
  index: Map<number, Surah>;
  target: HifzTarget | null;
  entries: HifzEntry[];
  pending: boolean;
  onSubmit: (input: Omit<EntryInput, 'studentId'>) => void;
}) {
  const [range, setRange] = useState<RangeValue>(() => {
    if (target) {
      return {
        surahNumber: target.surahNumber,
        ayahStart: nextAyahInTarget(entries, target),
        ayahEnd: target.ayahEnd,
      };
    }
    const s = surahs[0];
    return {
      surahNumber: s?.number ?? 1,
      ayahStart: 1,
      ayahEnd: s?.ayahCount ?? 7,
    };
  });
  const [kind, setKind] = useState<HifzKind>('NEW_HIFZ');
  const [rating, setRating] = useState<number | null>(null);
  const [tajweed, setTajweed] = useState('');
  const groupName = `kind-${target?.id ?? 'none'}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...range, kind, rating, tajweed: tajweed.trim() || null });
        setTajweed('');
        setRating(null);
      }}
    >
      <h4 className="font-semibold text-neutral-950">Log a recitation</h4>
      <p className="mt-0.5 text-sm text-neutral-600">
        {target
          ? 'Filled in from their target — change it if they recited something else.'
          : 'What did they just recite to you?'}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">
            What they recited
          </p>
          <RangeField surahs={surahs} value={range} onChange={setRange} />
          <p className="mt-1.5 text-xs text-neutral-500">
            {formatRef(index, range.surahNumber, range.ayahStart, range.ayahEnd)}
          </p>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">
            Was this new, or revision?
          </legend>
          <div className="space-y-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-3 transition',
                  kind === k.value
                    ? 'border-signal-600 bg-signal-50/60'
                    : 'border-neutral-200 hover:border-neutral-300',
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-signal-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">
                    {k.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-600">
                    {k.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">
            How did it go?{' '}
            <span className="font-normal text-neutral-500">(optional)</span>
          </p>
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Notes for the student{' '}
            <span className="font-normal text-neutral-500">(optional)</span>
          </span>
          <input
            value={tajweed}
            onChange={(e) => setTajweed(e.target.value)}
            maxLength={1000}
            placeholder="e.g. lengthen the madd in ayah 3"
            className={cn(inputClass, 'mt-1.5')}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={cn(btn('primary', 'md'), 'mt-5 gap-2')}
      >
        <PiCheck className="h-4 w-4" aria-hidden />
        {pending ? 'Saving…' : 'Save recitation'}
      </button>
    </form>
  );
}

function RecentRecitations({
  entries,
  index,
  pending,
  onDelete,
}: {
  entries: HifzEntry[];
  index: Map<number, Surah>;
  pending: boolean;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="mt-6 border-t border-neutral-100 pt-5 text-sm text-neutral-500">
        Nothing recorded yet — the first recitation you save will appear here.
      </p>
    );
  }

  return (
    <div className="mt-6 border-t border-neutral-100 pt-5">
      <h4 className="text-sm font-semibold text-neutral-950">Recently heard</h4>
      <ul className="mt-2 divide-y divide-neutral-100">
        {entries.slice(0, 6).map((e) => {
          const ref = shortRef(index, e.surahNumber, e.ayahStart, e.ayahEnd);
          return (
            <li key={e.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-950">
                    {ref}
                  </span>
                  <KindBadge kind={e.kind} />
                  <Rating value={e.rating} />
                  <span className="text-xs text-neutral-500">
                    {sinceDay(e.recordedAt)}
                  </span>
                </div>
                {e.tajweed && (
                  <p className="mt-1 text-sm text-neutral-600">{e.tajweed}</p>
                )}
                <TajweedCorrectionChips corrections={e.tajweedCorrections} />
              </div>
              <button
                onClick={() => onDelete(e.id)}
                disabled={pending}
                aria-label={`Remove ${ref}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
              >
                <PiTrash className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Targets: what to memorize next.
 *
 * Below the recitation form rather than beside it. Assigning happens roughly
 * once a week and recording happens every session, and the two used to sit side
 * by side as identical-looking forms — which is the single thing that made this
 * screen hard to read.
 */
function TargetSection({
  targets,
  surahs,
  index,
  pending,
  totalAyahs,
  memorized,
  onAdd,
  onDelete,
}: {
  targets: HifzTarget[];
  surahs: Surah[];
  index: Map<number, Surah>;
  pending: boolean;
  totalAyahs: number;
  memorized: number;
  onAdd: (input: Omit<TargetInput, 'studentId'>) => void;
  onDelete: (id: string) => void;
}) {
  // A student with nothing set needs the form, not a button that reveals it.
  const [adding, setAdding] = useState(targets.length === 0);

  return (
    <div className="mt-6 border-t border-neutral-100 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-neutral-950">
          What to memorize next
        </h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn(btn('secondary', 'sm'), 'gap-1.5')}
          >
            <PiPlus className="h-4 w-4" aria-hidden />
            Set a target
          </button>
        )}
      </div>

      {targets.length > 0 && (
        <ul className="mt-3 space-y-2">
          {targets.map((t) => {
            const ref = formatRef(index, t.surahNumber, t.ayahStart, t.ayahEnd);
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-950">{ref}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : 'No due date'}
                  </p>
                  {t.note && (
                    <p className="mt-1 text-sm text-neutral-600">{t.note}</p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(t.id)}
                  disabled={pending}
                  aria-label={`Remove target ${ref}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <TargetForm
          surahs={surahs}
          pending={pending}
          onCancel={targets.length > 0 ? () => setAdding(false) : null}
          onSubmit={(input) => {
            onAdd(input);
            if (targets.length > 0) setAdding(false);
          }}
        />
      )}

      <p className="mt-4 text-xs text-neutral-500">
        {memorized.toLocaleString()} of {totalAyahs.toLocaleString()}
        {' ayahs in the Qur’an memorized so far.'}
      </p>
    </div>
  );
}

function TargetForm({
  surahs,
  pending,
  onCancel,
  onSubmit,
}: {
  surahs: Surah[];
  pending: boolean;
  onCancel: (() => void) | null;
  onSubmit: (input: Omit<TargetInput, 'studentId'>) => void;
}) {
  const first = surahs[0];
  const [range, setRange] = useState<RangeValue>({
    surahNumber: first?.number ?? 1,
    ayahStart: 1,
    ayahEnd: first?.ayahCount ?? 7,
  });
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...range, dueAt: dueAt || null, note: note.trim() || null });
        setNote('');
        setDueAt('');
      }}
      className="mt-3 rounded-xl bg-neutral-50 p-3.5"
    >
      <RangeField surahs={surahs} value={range} onChange={setRange} />
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-neutral-600">
            Due by <span className="text-neutral-500">(optional)</span>
          </span>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={cn(inputClass, 'mt-1')}
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-600">
            Note <span className="text-neutral-500">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. focus on tajweed"
            className={cn(inputClass, 'mt-1')}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={cn(btn('secondary', 'sm'), 'gap-1.5')}
        >
          <PiPlus className="h-4 w-4" aria-hidden />
          {pending ? 'Saving…' : 'Set target'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
