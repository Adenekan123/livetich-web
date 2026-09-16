'use client';

import { useMemo, useState } from 'react';
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
  TAJWEED_RULE_GROUPS,
  TAJWEED_RULES,
  type RoomUser,
  type TajweedOutcome,
  type TajweedRule,
  type TajweedRuleGroupKey,
  type TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';
import {
  describeParts,
  graphemes,
  ruleArabic,
  ruleColor,
  ruleLabel,
  splitWords,
  TAJWEED_GROUP_COLORS,
  TAJWEED_OUTCOMES,
  type AnyTajweedMark,
  type TajweedHistoryItem,
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

/** What sits in Recent before this teacher has marked anything. */
const RECENT_FALLBACK: TajweedRule[] = [
  'nun.ikhfa_haqiqi',
  'madd.tabii',
  'qalqalah.kubra',
  'nun.idgham_ghunnah',
  'ghunnah.mushaddadah',
];

const tool =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 disabled:opacity-40';
const field =
  'h-9 min-w-0 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-signal-500 focus:outline-none';

const isLive = (m: AnyTajweedMark): m is TajweedTemporaryAnnotation & { live: true } =>
  m.live === true;

/**
 * The instructor's Tajweed controls, under the mushaf.
 *
 * Picking and marking are two separate acts, in that order: tap the words or
 * letters you mean — anywhere, in any ayah — and the class sees them outlined
 * while you choose the rule. The rule itself comes from Recent, from the group
 * dropdowns, or by typing its name, so the whole taxonomy costs three lines
 * instead of fifty chips.
 */
export function TajweedToolbar({
  api,
  students,
  surahName,
  ayahText,
  modes = ALL_MODES,
}: {
  api: TajweedApi;
  students: RoomUser[];
  /** Names the surah a part sits in, for saying where a mark is. */
  surahName: (surah: number) => string;
  /** The text of an ayah, for showing what is picked. The mushaf holds it —
   *  this only reads what a part points at. */
  ayahText: (surah: number, ayah: number) => string | null;
  /** Which modes this place offers. Preparing a lesson has no class to show
   *  live marks to and no student reciting, so it offers Lesson only. */
  modes?: TajweedMode[];
}) {
  const [note, setNote] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [needLabel, setNeedLabel] = useState(false);
  const [kept, setKept] = useState(false);
  const [pickingIssue, setPickingIssue] = useState(false);
  const [group, setGroup] = useState<TajweedRuleGroupKey | ''>('');
  const [query, setQuery] = useState('');
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

  const { parts, letters } = api.selection;
  const ready = parts.length > 0;

  /** The rules this teacher actually reaches for, most recent first. */
  const recent = useMemo(() => {
    const used = [...api.lesson, ...api.corrections]
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => m.rule)
      .filter((r): r is TajweedRule => !!r && TAJWEED_RULES[r]?.pickable);
    return [...new Set([...used, ...RECENT_FALLBACK])].slice(0, 5);
  }, [api.lesson, api.corrections]);

  /** Marks touching any word the selection touches, so what is already there
   *  is in front of the teacher before they add another. */
  const marksHere = useMemo(() => {
    if (!parts.length) return [];
    const touched = new Set(
      parts.map((p) => `${p.surahNumber}:${p.ayahNumber}:${p.wordIndex}`),
    );
    const seen = new Map<string, AnyTajweedMark>();
    for (const part of parts) {
      for (const m of api.index.get(`${part.surahNumber}:${part.ayahNumber}`) ?? []) {
        const hits = m.parts.some((p) =>
          touched.has(`${p.surahNumber}:${p.ayahNumber}:${p.wordIndex}`),
        );
        if (hits) seen.set(m.id, m);
      }
    }
    return [...seen.values()];
  }, [parts, api.index]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (Object.keys(TAJWEED_RULES) as TajweedRule[]).filter((key) => {
      const info = TAJWEED_RULES[key];
      return (
        info.pickable &&
        (info.label.toLowerCase().includes(q) ||
          (info.groupLabel ?? '').toLowerCase().includes(q) ||
          (info.arabic ?? '').includes(query.trim()))
      );
    });
  }, [query]);

  const done = () => {
    setNote('');
    setCustomLabel('');
    setNeedLabel(false);
    setPickingIssue(false);
    setQuery('');
    setHint(null);
    api.clearError();
  };

  const applyRule = (rule: TajweedRule) => {
    if (!ready) {
      setHint('Tap the words or letters you mean first.');
      return;
    }
    const label = customLabel.trim();
    if (rule === 'custom' && !label) {
      setNeedLabel(true);
      setHint('Give the custom note a label, then choose it again.');
      return;
    }
    const content = {
      rule,
      customLabel: rule === 'custom' ? label : undefined,
      note: note.trim() || undefined,
    };
    if (api.mode === 'LIVE') {
      api.showLive(rule, content);
    } else if (api.mode === 'LESSON') {
      api.create({
        mode: 'LESSON',
        kept,
        ...content,
        style: api.prefs.style,
        color: ruleColor(rule, api.prefs.colors),
      });
    } else {
      if (!api.correctionStudent) {
        setHint('Choose the student first.');
        return;
      }
      api.create({
        mode: 'STUDENT_CORRECTION',
        studentId: api.correctionStudent,
        outcome: 'TAJWEED_ISSUE',
        ...content,
        style: api.prefs.style,
        color: ruleColor(rule, api.prefs.colors),
      });
    }
    done();
  };

  const applyOutcome = (outcome: TajweedOutcome) => {
    if (!ready) {
      setHint('Tap the words or letters you mean first.');
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
      mode: 'STUDENT_CORRECTION',
      studentId: api.correctionStudent,
      outcome,
      note: note.trim() || undefined,
      style: api.prefs.style,
    });
    done();
  };

  /** A rule as a chip: one tap marks what is picked. */
  const RuleChip = ({ rule }: { rule: TajweedRule }) => (
    <button
      type="button"
      onClick={() => applyRule(rule)}
      title={ruleArabic(rule) ?? undefined}
      className={cn(tool, 'h-10 shrink-0 whitespace-nowrap px-3')}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: ruleColor(rule, api.prefs.colors) }}
      />
      {ruleLabel(rule, null)}
      {ruleArabic(rule) && (
        <span dir="rtl" lang="ar" className="font-quran text-sm text-neutral-400">
          {ruleArabic(rule)}
        </span>
      )}
    </button>
  );

  const statusMessage = hint ?? api.error;
  const what = letters ? 'letter' : 'word';

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
          {TAJWEED_RULE_GROUPS.map((g) => {
            const rules = g.rules.map((r) => `${g.key}.${r.key}` as TajweedRule);
            const hidden = api.hideAll || rules.every((r) => api.hiddenRules.has(r));
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={!hidden}
                onClick={() => {
                  if (api.hideAll) api.setHideAll(false);
                  for (const r of rules) {
                    if (api.hiddenRules.has(r) === !hidden) api.toggleRule(r);
                  }
                }}
                className={cn(tool, 'h-8', hidden && 'opacity-50')}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: api.prefs.colors[g.key] }}
                />
                {g.label}
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
            One colour per group — you read which madd from its name, not from fifty
            colours. Tajweed mushafs do not all use the same ones, so these are yours to
            change.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TAJWEED_RULE_GROUPS.map((g) => (
              <label key={g.key} className={cn(tool, 'h-8 cursor-pointer')}>
                <input
                  type="color"
                  value={api.prefs.colors[g.key] ?? TAJWEED_GROUP_COLORS[g.key]}
                  onChange={(e) => api.updatePrefs({ colors: { [g.key]: e.target.value } })}
                  className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${g.label} colour`}
                />
                {g.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* How a tap picks — decided before anything is picked, so the answer to
          "how do I mark one letter?" is on screen from the start. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="What a tap picks"
          className="flex rounded-lg border border-white/10 bg-white/5 p-0.5"
        >
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={letters === v}
              onClick={() => api.setLetters(v)}
              className={cn(
                'h-8 rounded-md px-3 text-xs font-semibold transition',
                letters === v ? 'bg-white text-neutral-900' : 'text-neutral-300 hover:bg-white/10',
              )}
            >
              {v ? 'Letters' : 'Words'}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-[11px] text-neutral-400">
          Tap each {what} you mean; tap it again to drop it. They may be in different
          ayahs, and everything you pick becomes one mark.
        </p>
      </div>

      {!ready ? (
        <p className="mt-2 text-xs text-neutral-400">
          Nothing picked yet — tap the text above. The class sees what you pick before you
          choose a rule.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            dir="rtl"
            lang="ar"
            className="font-quran max-w-full truncate rounded-lg bg-white/5 px-2.5 py-0.5 text-2xl leading-relaxed text-white"
          >
            {parts
              .map((p) =>
                p.wordIndex === null
                  ? `Ayah ${p.ayahNumber}`
                  : (() => {
                      const verse = ayahText(p.surahNumber, p.ayahNumber);
                      const w = verse ? (splitWords(verse)[p.wordIndex] ?? '') : '';
                      return p.letterIndex === null ? w : (graphemes(w)[p.letterIndex] ?? '');
                    })(),
              )
              .join(' ')}
          </span>
          <span className="text-[11px] text-neutral-400">
            {describeParts(parts, surahName)}
          </span>
          <button
            type="button"
            aria-label="Clear picks"
            onClick={() => {
              api.clearSelection();
              done();
            }}
            className={cn(tool, 'ml-auto')}
          >
            <PiXBold aria-hidden />
            Clear picks
          </button>
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
                style={{ backgroundColor: markColor(m, api.prefs.colors) }}
              />
              <span className="text-xs font-semibold text-white">{markLabel(m)}</span>
              {'kept' in m && m.kept && (
                <span className="rounded bg-white/10 px-1.5 py-px text-[10px] text-neutral-300">
                  kept
                </span>
              )}
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

      {ready && (
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
            {api.mode === 'LESSON' && (
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={kept}
                  onChange={(e) => setKept(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5"
                />
                Keep for next time
              </label>
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
            <div className="mt-2 space-y-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a rule — e.g. ikhfa, madd, qalqalah"
                aria-label="Find a rule"
                className={cn(field, 'w-full')}
              />
              {query ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {hits.length ? (
                    hits.map((rule) => <RuleChip key={rule} rule={rule} />)
                  ) : (
                    <p className="text-xs text-neutral-500">No rule matches “{query}”.</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Recent
                  </p>
                  {/* One line that scrolls sideways: a long list of rules never
                      pushes the text off the screen. */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {recent.map((rule) => (
                      <RuleChip key={rule} rule={rule} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="Rule group"
                      value={group}
                      onChange={(e) => setGroup(e.target.value as TajweedRuleGroupKey | '')}
                      className={cn(field, 'flex-1')}
                    >
                      <option value="" className="bg-neutral-900">
                        Choose a group…
                      </option>
                      {TAJWEED_RULE_GROUPS.map((g) => (
                        <option key={g.key} value={g.key} className="bg-neutral-900">
                          {g.label} · {g.arabic}
                        </option>
                      ))}
                    </select>
                    {group && (
                      <select
                        aria-label="Rule"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) applyRule(e.target.value as TajweedRule);
                        }}
                        className={cn(field, 'flex-1')}
                      >
                        <option value="" className="bg-neutral-900">
                          Choose a rule…
                        </option>
                        {TAJWEED_RULE_GROUPS.find((g) => g.key === group)?.rules.map((r) => (
                          <option
                            key={r.key}
                            value={`${group}.${r.key}`}
                            className="bg-neutral-900"
                          >
                            {r.label} · {r.arabic}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => applyRule('custom')}
                      className={cn(tool, 'h-9')}
                    >
                      Custom note
                    </button>
                  </div>
                </>
              )}
              {pickingIssue && (
                <button
                  type="button"
                  onClick={() => {
                    setPickingIssue(false);
                    setHint(null);
                  }}
                  className={cn(tool, 'h-9')}
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
            {ruleLabel(e.rule, null)}
            {ruleArabic(e.rule) && (
              <span dir="rtl" lang="ar" className="font-quran text-neutral-400">
                {ruleArabic(e.rule)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What a tapped mark says — for students, and for the teacher when not
 * annotating.
 *
 * The rule by name, in English and Arabic, on the words it was put on: what a
 * student needs in order to know what they are being taught, rather than a
 * colour they have to decode.
 */
export function TajweedMarkCard({
  mark,
  surahName,
  onClose,
}: {
  mark: AnyTajweedMark;
  surahName: (surah: number) => string;
  onClose: () => void;
}) {
  const arabic = ruleArabic(mark.rule);
  const group = mark.rule ? TAJWEED_RULES[mark.rule]?.groupLabel : null;
  return (
    <div data-tajweed-card className="border-t border-white/10 bg-neutral-950/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: markColor(mark) }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-white">
            {markLabel(mark)}
            {arabic && (
              <span dir="rtl" lang="ar" className="font-quran text-base font-normal text-neutral-300">
                {arabic}
              </span>
            )}
            {'studentId' in mark && mark.studentId && (
              <span className="text-xs font-normal text-amber-300">just for you</span>
            )}
          </p>
          <p className="text-xs text-neutral-400">
            {describeParts(mark.parts, surahName)}
            {group && ` · ${group}`}
          </p>
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
