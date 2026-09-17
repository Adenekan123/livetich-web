'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PiCaretDownBold,
  PiFunnelBold,
  PiGearSixBold,
  PiXBold,
} from 'react-icons/pi';
import {
  TAJWEED_RULE_GROUPS,
  TAJWEED_RULES,
  type TajweedPart,
  type TajweedRule,
  type TajweedRuleGroupKey,
  type TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';
import {
  describeParts,
  graphemes,
  hasPart,
  oneLetter,
  ruleArabic,
  ruleColor,
  ruleLabel,
  splitWords,
  TAJWEED_GROUP_COLORS,
  type AnyTajweedMark,
} from '@/lib/tajweed';
import { cn } from '@/lib/ui';
import { markColor, markLabel } from './tajweed-ayah';
import type { TajweedApi } from './use-tajweed';

/*
 * Lesson and student corrections are switched off for now, so a mark is only
 * ever shown to the class and never saved. Turning them back on means restoring
 * the mode selector, the student picker, the outcome buttons, the "Keep for
 * next time" switch, the note field, and the per-mark edit/delete/history row —
 * they exist to serve a saved mark, and there is nothing saved without them.
 *
 * const MODES: { key: TajweedMode; label: string; hint: string }[] = [
 *   { key: 'LIVE', label: 'Live', hint: 'Show it to the class now; not kept' },
 *   { key: 'LESSON', label: 'Lesson', hint: 'Save it with the lesson' },
 *   { key: 'CORRECTION', label: 'Correction', hint: "Record it against a student's recitation" },
 * ];
 * const OUTCOME_ICONS: Record<TajweedOutcome, IconType> = { ... };
 * const CHANGE_LABEL: Record<TajweedHistoryItem['change'], string> = { ... };
 * const ALL_MODES: TajweedMode[] = ['LIVE', 'LESSON', 'CORRECTION'];
 */

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

/** Every rule a teacher can choose, with what it can be found by. */
const PICKABLE: { rule: TajweedRule; label: string; arabic: string | null; group: string }[] =
  TAJWEED_RULE_GROUPS.flatMap((g) =>
    g.rules.map((r) => ({
      rule: `${g.key}.${r.key}` as TajweedRule,
      label: r.label,
      arabic: r.arabic,
      group: g.label,
    })),
  );

/**
 * One control for the whole taxonomy: type to narrow, arrows to move, Enter to
 * choose.
 *
 * A search box and two dropdowns asked the same question three ways. This asks
 * it once. It is written out rather than pulled in because the app has no
 * Radix or cmdk to build on, and a rule picker is not worth two dependencies.
 */
function RuleCombobox({
  onPick,
  colors,
}: {
  onPick: (rule: TajweedRule) => void;
  colors: Partial<Record<TajweedRuleGroupKey, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PICKABLE;
    return PICKABLE.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        (r.arabic ?? '').includes(query.trim()),
    );
  }, [query]);

  // Close on a click elsewhere or on Escape, the way a menu is expected to.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (rule: TajweedRule) => {
    onPick(rule);
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        // The dashboard's card gradient, in the tones that read on a dark
        // panel. Built from the signal tokens rather than a fixed teal, so it
        // follows whatever colour the workspace is themed to.
        className={cn(
          tool,
          'h-10 w-full justify-between border-signal-500/30 bg-gradient-to-br from-signal-900/50 to-neutral-900 px-3 text-white hover:from-signal-800/50',
        )}
      >
        Choose a rule…
        <PiCaretDownBold aria-hidden className={cn('transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full z-30 mb-1.5 w-full overflow-hidden rounded-xl border border-signal-500/30 bg-gradient-to-br from-signal-900/60 to-neutral-900 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="border-b border-signal-500/20 p-2">
            <input
              autoFocus
              type="search"
              value={query}
              aria-label="Find a rule"
              placeholder="Find a rule — e.g. ikhfa, madd, qalqalah"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => {
                    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
                    return (next + matches.length) % Math.max(1, matches.length);
                  });
                } else if (e.key === 'Enter' && matches[active]) {
                  e.preventDefault();
                  choose(matches[active].rule);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              className={cn(field, 'w-full border-signal-500/25 bg-neutral-950/40')}
            />
          </div>
          <ul role="listbox" aria-label="Tajweed rules" className="max-h-64 overflow-y-auto p-1">
            {matches.length === 0 && (
              <li className="px-2.5 py-3 text-center text-xs text-neutral-500">
                No rule matches “{query}”.
              </li>
            )}
            {matches.map((r, i) => (
              <li key={r.rule}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.rule)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                    i === active
                      ? 'bg-gradient-to-r from-signal-600/40 to-signal-600/10 text-white'
                      : 'text-neutral-200',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ruleColor(r.rule, colors) }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {r.label}
                    <span className="text-neutral-500"> · {r.group}</span>
                  </span>
                  {r.arabic && (
                    <span dir="rtl" lang="ar" className="font-quran shrink-0 text-sm text-neutral-400">
                      {r.arabic}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One word picked brings the words either side of it into the strip, so the
 *  letter beside it is a tap away rather than a fresh pick in the text. */
function withNeighbours(
  spot: { surahNumber: number; ayahNumber: number; wordIndex: number },
  ayahText: (surah: number, ayah: number) => string | null,
) {
  const verse = ayahText(spot.surahNumber, spot.ayahNumber);
  const count = verse ? splitWords(verse).length : 0;
  const out: typeof spot[] = [];
  for (
    let w = Math.max(0, spot.wordIndex - 1);
    w <= Math.min(count - 1, spot.wordIndex + 1);
    w++
  ) {
    out.push({ ...spot, wordIndex: w });
  }
  return out.length ? out : [spot];
}

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
  surahName,
  ayahText,
}: {
  api: TajweedApi;
  /** Names the surah a part sits in, for saying where a mark is. */
  surahName: (surah: number) => string;
  /** The text of an ayah, for showing what is picked. The mushaf holds it —
   *  this only reads what a part points at. */
  ayahText: (surah: number, ayah: number) => string | null;
  /* The students in the room and the modes on offer come back with Lesson and
     Correction: a live mark is shown to everyone, so it needs neither. */
}) {
  const [customLabel, setCustomLabel] = useState('');
  const [needLabel, setNeedLabel] = useState(false);
  const [panel, setPanel] = useState<'filter' | 'style' | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const { parts } = api.selection;
  const ready = parts.length > 0;

  /**
   * The words the picks touch, laid out letter by letter below.
   *
   * This is where a letter is chosen — never in the Qur'an itself, which stays
   * one unbroken run of joined letters. One word picked brings its neighbours
   * along, so reaching into the word beside it is a tap rather than a restart.
   */
  const strip = useMemo(() => {
    const spots = [
      ...new Map(
        parts
          .filter((p) => p.wordIndex !== null)
          .map((p) => [
            `${p.surahNumber}:${p.ayahNumber}:${p.wordIndex}`,
            { surahNumber: p.surahNumber, ayahNumber: p.ayahNumber, wordIndex: p.wordIndex! },
          ]),
      ).values(),
    ];
    if (!spots.length) return [];
    const cells = spots.length === 1 ? withNeighbours(spots[0], ayahText) : spots;
    return cells.map((cell) => {
      const verse = ayahText(cell.surahNumber, cell.ayahNumber);
      const word = verse ? (splitWords(verse)[cell.wordIndex] ?? '') : '';
      return { ...cell, word, letters: graphemes(word) };
    });
  }, [parts, ayahText]);

  /** The rules this teacher reaches for, most recent first. Nothing is saved
   *  while Live is the only mode, so this is what they have used this session. */
  const recent = useMemo(() => {
    const used = api.live
      .map((m) => m.rule)
      .filter((r): r is TajweedRule => !!r)
      .reverse();
    return [...new Set([...used, ...RECENT_FALLBACK])].slice(0, 5);
  }, [api.live]);

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

  const done = () => {
    setCustomLabel('');
    setNeedLabel(false);
    setHint(null);
    api.clearError();
  };

  /** Show the rule to the class. Nothing is saved while Live is the only mode. */
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
    api.showLive(rule, {
      customLabel: rule === 'custom' ? label : undefined,
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

  return (
    <div
      data-tajweed-toolbar
      // The dashboard card's gradient across the whole panel, from the signal
      // tokens so it follows whatever colour the workspace is themed to. It
      // fades out rather than tinting the full width: this sits under the text
      // being taught, and should not compete with it.
      className="border-t border-signal-500/25 bg-gradient-to-br from-signal-900/50 via-neutral-950 to-neutral-950 px-3 py-2.5 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* The mode selector and the student picker live here when Lesson and
            Correction are switched back on. */}
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-signal-500/20 bg-white/5 p-2">
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
        <div className="mt-2 space-y-2 rounded-lg border border-signal-500/20 bg-white/5 p-2">
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

      {!ready ? (
        <p className="mt-2 text-xs text-neutral-400">
          Nothing picked yet — tap the words you mean in the text above. They may be in
          different ayahs, and everything you pick becomes one mark. The class sees your
          picks before you choose a rule.
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

      {strip.length > 0 && (
        <div className="mt-2 rounded-lg border border-signal-500/20 bg-white/5 p-2">
          <p className="text-[11px] text-neutral-400">
            Tap a letter to mark just that letter instead of the whole word — one here and
            one in the word beside it, if that is what the rule holds.
          </p>
          <div dir="rtl" className="mt-1.5 flex flex-wrap gap-3">
            {strip.map((cell) => (
              <div
                key={`${cell.surahNumber}:${cell.ayahNumber}:${cell.wordIndex}`}
                className="grid justify-items-center gap-1"
              >
                <span dir="rtl" lang="ar" className="font-quran text-base text-neutral-400">
                  {cell.word}
                </span>
                <div className="flex gap-1">
                  {cell.letters.map((g, i) => {
                    const part = oneLetter(
                      cell.surahNumber,
                      cell.ayahNumber,
                      cell.wordIndex,
                      i,
                    );
                    const on = hasPart(parts, part);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        aria-label={`Ayah ${cell.ayahNumber}, word ${cell.wordIndex + 1}, letter ${i + 1}`}
                        data-strip-letter
                        onClick={() => api.pickPart(part)}
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
              </div>
            ))}
          </div>
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
              {/* "kept" and "saving…" belong to a mark on its way to the
                  database; nothing is saved while Live is the only mode. */}
              {isLive(m) && (
                <span className="rounded bg-white/10 px-1.5 py-px text-[10px] text-neutral-300">
                  live
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">{m.note}</span>
              <span className="ml-auto flex gap-1">
                {isLive(m) && (
                  <button
                    type="button"
                    aria-label="Clear live mark"
                    onClick={() => api.clearLive(m.id)}
                    className={cn(tool, 'h-8')}
                  >
                    <PiXBold aria-hidden />
                  </button>
                )}
                {/* Save to lesson, the note editor, the history panel and delete
                    return with Lesson and Correction. */}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ready && (
        <div className="mt-2 space-y-2">
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
          {/* The teacher note is switched off with Lesson and Correction: a
              live mark is spoken aloud, not read later. */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Recent
          </p>
          {/* One line that scrolls sideways: a long list of rules never pushes
              the text off the screen. */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recent.map((rule) => (
              <RuleChip key={rule} rule={rule} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[14rem] flex-1">
              <RuleCombobox onPick={applyRule} colors={api.prefs.colors} />
            </div>
            <button
              type="button"
              onClick={() => applyRule('custom')}
              className={cn(tool, 'h-10')}
            >
              Custom note
            </button>
          </div>
        </div>
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
 * What the class is told, without having to tap anything.
 *
 * While the instructor is picking, the same letters are outlined on every
 * screen and this says so in words. Once they choose a rule, it says which
 * rule — by name and in Arabic, on the words it was put on — and stays until
 * the next one, so a student who looked up a second late has not missed it.
 */
export function TajweedNotice({
  pointing,
  mark,
  textOf,
  surahName,
  colors,
  onDismiss,
}: {
  pointing: readonly TajweedPart[];
  mark: AnyTajweedMark | null;
  /** The Arabic some parts point at, read off the mushaf itself. */
  textOf: (parts: readonly TajweedPart[]) => string;
  surahName: (surah: number) => string;
  colors?: Partial<Record<TajweedRuleGroupKey, string>>;
  onDismiss: () => void;
}) {
  if (!pointing.length && !mark) return null;
  const isPrivate = !!mark && 'studentId' in mark && !!mark.studentId;
  const arabic = mark ? ruleArabic(mark.rule) : null;
  return (
    <div
      data-tajweed-notice
      // Sized to what it says and centred: on a wide screen a full-bleed bar
      // is mostly empty, and every pixel of height here is taken from the text
      // being taught.
      className="flex flex-wrap items-start justify-center gap-2 border-b border-white/10 bg-neutral-950/60 px-4 py-2"
    >
      {pointing.length > 0 && (
        <div
          role="status"
          className="flex max-w-full items-center gap-3 rounded-xl border-2 border-dashed border-signal-400/60 px-3 py-1.5 sm:max-w-md"
        >
          <span
            dir="rtl"
            lang="ar"
            className="font-quran min-w-0 max-w-[45%] truncate text-2xl text-white"
          >
            {textOf(pointing)}
          </span>
          <span className="min-w-0">
            <b className="block text-sm font-semibold text-white">
              Your instructor is pointing here
            </b>
            <span className="text-xs text-neutral-400">
              {describeParts(pointing, surahName)}
            </span>
          </span>
        </div>
      )}
      {mark && (
        <div
          role="status"
          className={cn(
            'flex max-w-full items-stretch gap-3 overflow-hidden rounded-xl border sm:max-w-xl',
            isPrivate ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-white/5',
          )}
        >
          <span
            aria-hidden
            className="w-1.5 shrink-0"
            style={{ backgroundColor: markColor(mark, colors) }}
          />
          <span
            dir="rtl"
            lang="ar"
            className="font-quran min-w-0 max-w-[45%] self-center truncate py-1.5 text-2xl text-white"
          >
            {textOf(mark.parts)}
          </span>
          <span className="min-w-0 py-1.5">
            <b className="block text-sm font-semibold text-white">
              {isPrivate
                ? `Just for you · ${markLabel(mark)}`
                : `Your instructor marked this as ${markLabel(mark)}`}
            </b>
            {arabic && (
              <span dir="rtl" lang="ar" className="font-quran block text-base text-neutral-300">
                {arabic}
              </span>
            )}
            <span className="block truncate text-xs text-neutral-400">
              {describeParts(mark.parts, surahName)}
              {mark.note ? ` · “${mark.note}”` : ''}
            </span>
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid w-9 shrink-0 place-items-center text-neutral-500 hover:text-white"
          >
            <PiXBold />
          </button>
        </div>
      )}
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
