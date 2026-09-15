'use client';

import { useState } from 'react';
import {
  PiArrowCounterClockwiseBold,
  PiCheckBold,
  PiClockCounterClockwiseBold,
  PiExclamationMarkBold,
  PiFloppyDiskBold,
  PiFunnelBold,
  PiGearSixBold,
  PiNotePencilBold,
  PiTrashBold,
  PiWarningBold,
  PiXBold,
} from 'react-icons/pi';
import type { IconType } from 'react-icons';
import {
  TAJWEED_RULE_KEYS,
  TAJWEED_RULES,
  type RoomUser,
  type TajweedOutcome,
  type TajweedRule,
  type TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';
import {
  ayahKey,
  graphemes,
  splitWords,
  TAJWEED_OUTCOMES,
  type AnyTajweedMark,
  type TajweedHistoryItem,
  type TajweedSelectionState,
} from '@/lib/tajweed';
import { cn } from '@/lib/ui';
import { markColor, markLabel } from './tajweed-ayah';
import type { SavedMark, TajweedApi, TajweedMode } from './use-tajweed';

const MODES: { key: TajweedMode; label: string; hint: string }[] = [
  { key: 'LIVE', label: 'Live', hint: 'Show it to the class now; not kept' },
  { key: 'LESSON', label: 'Lesson', hint: 'Save it with the lesson' },
  { key: 'CORRECTION', label: 'Correction', hint: "Record it against a student's recitation" },
];

const ALL_MODES: TajweedMode[] = ['LIVE', 'LESSON', 'CORRECTION'];

const CHANGE_LABEL: Record<TajweedHistoryItem['change'], string> = {
  CREATED: 'Created',
  UPDATED: 'Edited',
  DELETED: 'Deleted',
};

const OUTCOME_ICONS: Record<TajweedOutcome, IconType> = {
  CORRECT: PiCheckBold,
  REPEAT: PiArrowCounterClockwiseBold,
  TAJWEED_ISSUE: PiWarningBold,
  PRONUNCIATION: PiExclamationMarkBold,
  NOTE: PiNotePencilBold,
};

const LIVE_DURATIONS = [
  { seconds: 0, label: 'Until cleared' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 120, label: '2 minutes' },
  { seconds: 300, label: '5 minutes' },
];

const tool =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 disabled:opacity-40';
const field =
  'h-9 min-w-0 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-signal-500 focus:outline-none';

const isLive = (m: AnyTajweedMark): m is TajweedTemporaryAnnotation & { live: true } =>
  m.live === true;

function overlaps(m: AnyTajweedMark, s: TajweedSelectionState) {
  if (m.selection === 'AYAH' || s.selection === 'AYAH') return true;
  const [a1, a2] = [m.wordStart ?? 0, m.wordEnd ?? m.wordStart ?? 0];
  const [b1, b2] = [s.wordStart ?? 0, s.wordEnd ?? s.wordStart ?? 0];
  return a1 <= b2 && b1 <= a2;
}

/**
 * The instructor's Tajweed controls, under the mushaf.
 *
 * The common path is two taps: a word in the text, then a rule here. Mode
 * decides what that tap does, and everything else — letters, notes, styles,
 * filters — stays one step aside so it never stands in the way of teaching.
 */
export function TajweedToolbar({
  api,
  selection,
  setSelection,
  ayahText,
  students,
  modes = ALL_MODES,
}: {
  api: TajweedApi;
  selection: TajweedSelectionState | null;
  setSelection: (s: TajweedSelectionState | null) => void;
  /** The text of the selected ayah, for previews and letter picking. */
  ayahText: string | null;
  students: RoomUser[];
  /** Which modes this place offers. Preparing a lesson has no class to show
   *  live marks to and no student reciting, so it offers Lesson only. */
  modes?: TajweedMode[];
}) {
  const [note, setNote] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [needLabel, setNeedLabel] = useState(false);
  const [pickingIssue, setPickingIssue] = useState(false);
  const [panel, setPanel] = useState<'filter' | 'style' | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<{
    id: string;
    items: TajweedHistoryItem[] | null;
    error: string | null;
  } | null>(null);

  const openHistory = (id: string) => {
    setHistoryFor({ id, items: null, error: null });
    api
      .history(id)
      .then((items) =>
        setHistoryFor((h) => (h?.id === id ? { id, items, error: null } : h)),
      )
      .catch((e: unknown) =>
        setHistoryFor((h) =>
          h?.id === id
            ? { id, items: null, error: e instanceof Error ? e.message : 'Could not load history' }
            : h,
        ),
      );
  };

  const words = ayahText ? splitWords(ayahText) : [];
  const ready =
    !!selection && (selection.selection !== 'LETTERS' || selection.letterStart !== null);
  const marksHere = selection
    ? (api.index.get(ayahKey(selection.surahNumber, selection.ayahNumber)) ?? []).filter((m) =>
        overlaps(m, selection),
      )
    : [];

  const done = () => {
    setNote('');
    setCustomLabel('');
    setNeedLabel(false);
    setPickingIssue(false);
    setHint(null);
    api.clearError();
  };

  const applyRule = (rule: TajweedRule) => {
    if (!selection || !ready) {
      setHint(selection ? 'Tap the letters to mark first.' : 'Tap a word in the text first.');
      return;
    }
    const label = customLabel.trim();
    if (rule === 'custom' && !label) {
      setNeedLabel(true);
      setHint('Give the custom note a label, then tap Custom note again.');
      return;
    }
    const content = {
      rule,
      customLabel: rule === 'custom' ? label : undefined,
      note: note.trim() || undefined,
    };
    if (api.mode === 'LIVE') {
      api.showLive(selection, rule, content);
    } else if (api.mode === 'LESSON') {
      api.create({
        ...selection,
        mode: 'LESSON',
        ...content,
        style: api.prefs.style,
        color: api.prefs.colors[rule],
      });
    } else {
      if (!api.correctionStudent) {
        setHint('Choose the student first.');
        return;
      }
      api.create({
        ...selection,
        mode: 'STUDENT_CORRECTION',
        studentId: api.correctionStudent,
        outcome: 'TAJWEED_ISSUE',
        ...content,
        style: api.prefs.style,
        color: api.prefs.colors[rule],
      });
    }
    done();
  };

  const applyOutcome = (outcome: TajweedOutcome) => {
    if (!selection || !ready) {
      setHint(selection ? 'Tap the letters to mark first.' : 'Tap a word in the text first.');
      return;
    }
    if (!api.correctionStudent) {
      setHint('Choose the student first.');
      return;
    }
    if (outcome === 'TAJWEED_ISSUE') {
      setPickingIssue(true);
      setHint('Which rule needs work?');
      return;
    }
    if (outcome === 'NOTE' && !note.trim()) {
      setHint('Write the note first.');
      return;
    }
    api.create({
      ...selection,
      mode: 'STUDENT_CORRECTION',
      studentId: api.correctionStudent,
      outcome,
      note: note.trim() || undefined,
      style: api.prefs.style,
    });
    done();
  };

  const pickLetter = (i: number) => {
    if (!selection) return;
    const { letterStart: s, letterEnd: e } = selection;
    // First tap picks a letter; a second tap on another letter stretches the
    // range to it; tapping again once a range is set starts over.
    const [from, to] = s === null || s !== e ? [i, i] : [Math.min(s, i), Math.max(s, i)];
    setSelection({ ...selection, letterStart: from, letterEnd: to });
  };

  const statusMessage = hint ?? api.error;

  return (
    <div data-tajweed-toolbar className="border-t border-white/10 bg-neutral-950/70 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="What a rule does"
          className="flex rounded-lg border border-white/10 bg-white/5 p-0.5"
        >
          {MODES.filter((m) => modes.includes(m.key)).map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={api.mode === m.key}
              title={m.hint}
              onClick={() => {
                api.setMode(m.key);
                setPickingIssue(false);
                setHint(null);
              }}
              className={cn(
                'h-8 rounded-md px-3 text-xs font-semibold transition',
                api.mode === m.key ? 'bg-signal-600 text-white' : 'text-neutral-300 hover:bg-white/10',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {api.mode === 'CORRECTION' && (
          <select
            aria-label="Student reciting"
            value={api.correctionStudent ?? ''}
            onChange={(e) => api.setCorrectionStudent(e.target.value || null)}
            className={cn(field, 'max-w-[11rem]')}
          >
            <option value="" className="bg-neutral-900">
              {students.length ? 'Student reciting…' : 'No students in the room'}
            </option>
            {students.map((s) => (
              <option key={s.userId} value={s.userId} className="bg-neutral-900">
                {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {api.live.length > 0 && (
            <button type="button" onClick={() => api.clearLive()} className={tool}>
              <PiXBold aria-hidden />
              Clear live ({api.live.length})
            </button>
          )}
          <button
            type="button"
            aria-pressed={panel === 'filter'}
            onClick={() => setPanel((p) => (p === 'filter' ? null : 'filter'))}
            className={cn(tool, panel === 'filter' && 'border-signal-500/50 bg-signal-500/15')}
          >
            <PiFunnelBold aria-hidden />
            Show
          </button>
          <button
            type="button"
            aria-pressed={panel === 'style'}
            onClick={() => setPanel((p) => (p === 'style' ? null : 'style'))}
            className={cn(tool, panel === 'style' && 'border-signal-500/50 bg-signal-500/15')}
          >
            <PiGearSixBold aria-hidden />
            Style
          </button>
        </div>
      </div>

      {panel === 'filter' && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
          {TAJWEED_RULE_KEYS.map((rule) => {
            const hidden = api.hideAll || api.hiddenRules.has(rule);
            return (
              <button
                key={rule}
                type="button"
                aria-pressed={!hidden}
                onClick={() => {
                  if (api.hideAll) api.setHideAll(false);
                  api.toggleRule(rule);
                }}
                className={cn(tool, 'h-8', hidden && 'opacity-50')}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: api.prefs.colors[rule] }}
                />
                {TAJWEED_RULES[rule].label}
              </button>
            );
          })}
          <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" onClick={api.showAll} className={cn(tool, 'h-8')}>
            Show all
          </button>
          <button type="button" onClick={() => api.setHideAll(true)} className={cn(tool, 'h-8')}>
            Hide all
          </button>
        </div>
      )}

      {panel === 'style' && (
        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400">Mark with</span>
            {(['HIGHLIGHT', 'UNDERLINE'] as const).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={api.prefs.style === style}
                onClick={() => api.updatePrefs({ style })}
                className={cn(
                  tool,
                  'h-8',
                  api.prefs.style === style && 'border-signal-500/50 bg-signal-500/15 text-white',
                )}
              >
                {style === 'HIGHLIGHT' ? 'Highlight + label' : 'Underline + label'}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
              Live marks stay
              <select
                value={api.prefs.liveSeconds}
                onChange={(e) => api.updatePrefs({ liveSeconds: Number(e.target.value) })}
                className={cn(field, 'h-8')}
              >
                {LIVE_DURATIONS.map((d) => (
                  <option key={d.seconds} value={d.seconds} className="bg-neutral-900">
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-neutral-500">
            Colours are yours to choose — Tajweed mushafs do not all use the same ones.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TAJWEED_RULE_KEYS.map((rule) => (
              <label key={rule} className={cn(tool, 'h-8 cursor-pointer')}>
                <input
                  type="color"
                  value={api.prefs.colors[rule]}
                  onChange={(e) => api.updatePrefs({ colors: { [rule]: e.target.value } })}
                  className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${TAJWEED_RULES[rule].label} colour`}
                />
                {TAJWEED_RULES[rule].label}
              </label>
            ))}
          </div>
        </div>
      )}

      {!selection ? (
        <p className="mt-2 text-xs text-neutral-400">
          Tap a word in the text to mark it. Tap it again to mark single letters.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            dir="rtl"
            lang="ar"
            className="font-quran max-w-full truncate rounded-lg bg-white/5 px-2.5 py-0.5 text-2xl leading-relaxed text-white"
          >
            {selection.selection === 'AYAH'
              ? `Ayah ${selection.ayahNumber}`
              : words
                  .slice(
                    selection.wordStart ?? 0,
                    (selection.wordEnd ?? selection.wordStart ?? 0) + 1,
                  )
                  .join(' ')}
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <button
              type="button"
              aria-pressed={selection.selection === 'AYAH'}
              onClick={() =>
                setSelection({
                  ...selection,
                  selection: 'AYAH',
                  wordStart: null,
                  wordEnd: null,
                  letterStart: null,
                  letterEnd: null,
                })
              }
              className={tool}
            >
              Whole ayah
            </button>
            {selection.selection !== 'AYAH' && selection.wordStart === selection.wordEnd && (
              <button
                type="button"
                aria-pressed={selection.selection === 'LETTERS'}
                onClick={() =>
                  setSelection({
                    ...selection,
                    selection: selection.selection === 'LETTERS' ? 'WORD' : 'LETTERS',
                    letterStart: null,
                    letterEnd: null,
                  })
                }
                className={cn(
                  tool,
                  selection.selection === 'LETTERS' && 'border-signal-500/50 bg-signal-500/15',
                )}
              >
                Letters
              </button>
            )}
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => {
                setSelection(null);
                done();
              }}
              className={tool}
            >
              <PiXBold aria-hidden />
            </button>
          </div>
        </div>
      )}

      {selection?.selection === 'LETTERS' && selection.wordStart !== null && (
        <div dir="rtl" lang="ar" className="mt-2 flex flex-wrap gap-1.5">
          {graphemes(words[selection.wordStart] ?? '').map((g, i) => {
            const on =
              selection.letterStart !== null &&
              i >= selection.letterStart &&
              i <= (selection.letterEnd ?? selection.letterStart);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={`Letter ${i + 1}`}
                onClick={() => pickLetter(i)}
                className={cn(
                  'font-quran grid h-12 min-w-11 place-items-center rounded-lg border px-2 text-2xl transition',
                  on
                    ? 'border-signal-400 bg-signal-500/25 text-white'
                    : 'border-white/10 bg-white/5 text-neutral-100 hover:bg-white/10',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}

      {marksHere.length > 0 && (
        <ul className="mt-2 space-y-1">
          {marksHere.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: markColor(m) }}
              />
              <span className="text-xs font-semibold text-white">{markLabel(m)}</span>
              {isLive(m) ? (
                <span className="rounded bg-white/10 px-1.5 py-px text-[10px] text-neutral-300">
                  live
                </span>
              ) : (m as SavedMark).pending ? (
                <span className="text-[10px] text-amber-300">saving…</span>
              ) : null}
              {editing?.id === m.id ? (
                <input
                  autoFocus
                  value={editing.note}
                  maxLength={1000}
                  onChange={(e) => setEditing({ id: m.id, note: e.target.value })}
                  placeholder="Teacher note"
                  className={cn(field, 'h-8 flex-1')}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">{m.note}</span>
              )}
              <span className="ml-auto flex gap-1">
                {isLive(m) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => api.liveToLesson(m)}
                      className={cn(tool, 'h-8')}
                    >
                      <PiFloppyDiskBold aria-hidden />
                      Save to lesson
                    </button>
                    <button
                      type="button"
                      aria-label="Clear live mark"
                      onClick={() => api.clearLive(m.id)}
                      className={cn(tool, 'h-8')}
                    >
                      <PiXBold aria-hidden />
                    </button>
                  </>
                ) : editing?.id === m.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void api.update(m as SavedMark, { note: editing.note.trim() || null });
                        setEditing(null);
                      }}
                      className={cn(tool, 'h-8 border-signal-500/50 bg-signal-500/15 text-white')}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className={cn(tool, 'h-8')}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {!(m as SavedMark).pending && (
                      <button
                        type="button"
                        aria-label="Annotation history"
                        title="History"
                        onClick={() => openHistory(m.id)}
                        className={cn(tool, 'h-8')}
                      >
                        <PiClockCounterClockwiseBold aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing({ id: m.id, note: m.note ?? '' })}
                      className={cn(tool, 'h-8')}
                    >
                      <PiNotePencilBold aria-hidden />
                      Note
                    </button>
                    <button
                      type="button"
                      aria-label="Delete annotation"
                      onClick={() => void api.remove(m as SavedMark)}
                      className={cn(tool, 'h-8 text-rose-300 hover:bg-rose-500/15')}
                    >
                      <PiTrashBold aria-hidden />
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {historyFor && (
        <div
          data-tajweed-history
          className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              History
            </p>
            <button
              type="button"
              aria-label="Close history"
              onClick={() => setHistoryFor(null)}
              className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <PiXBold />
            </button>
          </div>
          {historyFor.error ? (
            <p className="mt-1 text-xs text-rose-300">{historyFor.error}</p>
          ) : !historyFor.items ? (
            <p className="mt-1 text-xs text-neutral-400">Loading…</p>
          ) : (
            <ol className="mt-1 space-y-1">
              {historyFor.items.map((h) => (
                <li key={h.id} className="text-xs text-neutral-300">
                  <span className="font-semibold text-white">{CHANGE_LABEL[h.change]}</span>{' '}
                  by {h.changedBy.name} ·{' '}
                  {new Date(h.changedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {h.snapshot.note && (
                    <span className="text-neutral-500"> — “{h.snapshot.note}”</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {selection && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Teacher note (optional)"
              className={cn(field, 'flex-1')}
            />
            {needLabel && (
              <input
                autoFocus
                value={customLabel}
                maxLength={60}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Label"
                className={cn(field, 'w-36')}
              />
            )}
          </div>

          {api.mode === 'CORRECTION' && !pickingIssue ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TAJWEED_OUTCOMES.map((o) => {
                const Icon = OUTCOME_ICONS[o.key];
                return (
                  <button
                    key={o.key}
                    type="button"
                    title={o.hint}
                    onClick={() => applyOutcome(o.key)}
                    className={cn(tool, 'h-10 px-3')}
                  >
                    <Icon aria-hidden />
                    {o.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TAJWEED_RULE_KEYS.map((rule) => (
                <button
                  key={rule}
                  type="button"
                  title={TAJWEED_RULES[rule].description}
                  onClick={() => applyRule(rule)}
                  className={cn(tool, 'h-10 px-3')}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: api.prefs.colors[rule] }}
                  />
                  {TAJWEED_RULES[rule].label}
                </button>
              ))}
              {pickingIssue && (
                <button
                  type="button"
                  onClick={() => {
                    setPickingIssue(false);
                    setHint(null);
                  }}
                  className={cn(tool, 'h-10')}
                >
                  Back
                </button>
              )}
            </div>
          )}
        </>
      )}

      {statusMessage && (
        <p role="status" className="mt-2 text-xs text-amber-300">
          {statusMessage}
        </p>
      )}
    </div>
  );
}

/** Rules on the page and how they look — built from what is drawn, so it is
 *  always true to the colours in use. */
export function TajweedLegend({ entries }: { entries: { rule: TajweedRule; color: string }[] }) {
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/90 p-2.5 shadow-xl backdrop-blur">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        Tajweed legend
      </p>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.rule} className="flex items-center gap-2 text-xs text-neutral-200">
            <span aria-hidden className="h-1 w-6 rounded-full" style={{ backgroundColor: e.color }} />
            {TAJWEED_RULES[e.rule].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a tapped mark says — for students, and for the teacher when not
 *  annotating. */
export function TajweedMarkCard({ mark, onClose }: { mark: AnyTajweedMark; onClose: () => void }) {
  const rule = mark.rule ? TAJWEED_RULES[mark.rule] : null;
  return (
    <div data-tajweed-card className="border-t border-white/10 bg-neutral-950/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: markColor(mark) }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {markLabel(mark)}
            {'studentId' in mark && mark.studentId && (
              <span className="ml-2 text-xs font-normal text-neutral-400">correction</span>
            )}
          </p>
          {rule && mark.rule !== 'custom' && (
            <p className="text-xs text-neutral-400">{rule.description}</p>
          )}
          {mark.note && <p className="mt-1 text-sm text-neutral-200">{mark.note}</p>}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          <PiXBold />
        </button>
      </div>
    </div>
  );
}
