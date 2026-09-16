'use client';

import { memo, useMemo, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { TajweedPart, TajweedRuleGroupKey } from '@/lib/realtime-contract';
import {
  coverage,
  graphemes,
  hasPart,
  oneLetter,
  partsIn,
  ruleColor,
  ruleLabel,
  splitWords,
  TAJWEED_OUTCOMES,
  wholeWord,
  type AnyTajweedMark,
} from '@/lib/tajweed';
import { cn } from '@/lib/ui';

const OUTCOME_COLORS: Record<string, string> = {
  CORRECT: '#16a34a',
  REPEAT: '#ca8a04',
  PRONUNCIATION: '#dc2626',
  NOTE: '#64748b',
};

export function markColor(
  m: AnyTajweedMark,
  overrides: Partial<Record<TajweedRuleGroupKey, string>> = {},
): string {
  if (m.color) return m.color;
  if (m.rule) return ruleColor(m.rule, overrides);
  return ('outcome' in m && m.outcome && OUTCOME_COLORS[m.outcome]) || '#64748b';
}

export function markLabel(m: AnyTajweedMark): string {
  const rule = m.rule ? ruleLabel(m.rule, m.customLabel) : null;
  if ('outcome' in m && m.outcome) {
    if (m.outcome === 'TAJWEED_ISSUE') return `${rule ?? 'Tajweed'} issue`;
    return TAJWEED_OUTCOMES.find((o) => o.key === m.outcome)?.label ?? 'Note';
  }
  return rule ?? 'Note';
}

/** #rrggbb plus an alpha byte, for tinted backgrounds. */
const tint = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** How a set of marks draws one run of text. The first highlight fills it; the
 *  first underline underlines it; a live mark gets a dashed outline, so a
 *  teacher can tell at a glance what will vanish and what is kept. */
function styleFor(marks: readonly AnyTajweedMark[]): CSSProperties {
  if (!marks.length) return {};
  const fill = marks.find((m) => m.style === 'HIGHLIGHT');
  const line = marks.find((m) => m.style === 'UNDERLINE');
  const live = marks.find((m) => m.live);
  return {
    ...(fill && {
      backgroundColor: tint(markColor(fill), 0.3),
      borderRadius: '0.3em',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
    }),
    ...(line && {
      textDecorationLine: 'underline',
      textDecorationColor: markColor(line),
      textDecorationThickness: '0.08em',
      textUnderlineOffset: '0.35em',
    }),
    ...(live && {
      outline: `2px dashed ${markColor(live)}`,
      outlineOffset: '2px',
      borderRadius: '0.3em',
    }),
  };
}

const pickedStyle = 'rounded-md bg-signal-400/25 shadow-[0_0_0_2px_rgba(45,212,191,0.85)]';
/** What the class sees while the teacher is still deciding: the same letters,
 *  outlined rather than filled, so a pick never looks like a mark. */
const pointedStyle = 'rounded-md outline-2 outline-dashed outline-signal-400/80 outline-offset-2';

export interface TajweedAyahProps {
  surah: number;
  ayah: number;
  text: string;
  /** Marks touching this ayah — a mark reaching in from the one before is here
   *  too, drawn on the parts it holds in this ayah. */
  marks: readonly AnyTajweedMark[];
  /** Changes whenever anything about `marks` that is drawn changes. */
  marksKey: string;
  /** What the teacher has picked in this ayah. */
  picked: readonly TajweedPart[];
  /** What the instructor is pointing at, for everyone else's screen. */
  pointed: readonly TajweedPart[];
  /** A tap picks a letter rather than the whole word. */
  letters: boolean;
  anchor: boolean;
  /** The teacher is annotating: words and letters are tap targets. */
  interactive: boolean;
  /** "﴿٧﴾" */
  numeral: string;
  onPart: (part: TajweedPart) => void;
  onAyah: ((ayah: number) => void) | null;
  onMark: (mark: AnyTajweedMark) => void;
}

function Label({ mark, onMark }: { mark: AnyTajweedMark; onMark: (m: AnyTajweedMark) => void }) {
  const color = markColor(mark);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onMark(mark);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onMark(mark);
        }
      }}
      data-tajweed-label
      dir="ltr"
      title={markLabel(mark)}
      className="pointer-events-auto min-w-0 cursor-pointer truncate rounded px-1 font-sans font-semibold leading-tight"
      // White on the rule's own colour: a tinted label in the same hue as its
      // text all but vanished against the dark page.
      style={{ color: '#ffffff', backgroundColor: color }}
    >
      {markLabel(mark)}
    </span>
  );
}

function AyahImpl({
  surah,
  ayah,
  text,
  marks,
  picked,
  pointed,
  letters,
  anchor,
  interactive,
  numeral,
  onPart,
  onAyah,
  onMark,
}: TajweedAyahProps) {
  const words = useMemo(() => splitWords(text), [text]);
  const ayahMarks = marks.filter((m) => coverage(m, surah, ayah, 0) === 'ayah');
  const ayahPicked = picked.some((p) => p.wordIndex === null);

  const tap = (
    e: MouseEvent | KeyboardEvent,
    part: TajweedPart,
    wordMarks: AnyTajweedMark[],
  ) => {
    if (interactive) {
      e.stopPropagation();
      onPart(part);
    } else if (wordMarks.length) {
      e.stopPropagation();
      onMark(wordMarks[0]);
    }
  };

  return (
    <span
      data-ayah={ayah}
      onClick={!interactive && onAyah ? () => onAyah(ayah) : undefined}
      className={cn(
        'rounded-lg px-1 transition-colors',
        !interactive && onAyah && 'cursor-pointer',
        anchor ? 'bg-white/15 text-white' : !interactive && 'hover:bg-white/5',
        ayahPicked && pickedStyle,
      )}
      style={styleFor(ayahMarks)}
    >
      {words.map((word, i) => {
        const wordMarks: AnyTajweedMark[] = [];
        const letterMarks: { mark: AnyTajweedMark; letters: number[] }[] = [];
        for (const m of marks) {
          const c = coverage(m, surah, ayah, i);
          if (c === 'word') wordMarks.push(m);
          else if (Array.isArray(c)) letterMarks.push({ mark: m, letters: c });
        }
        const wordPart = wholeWord(surah, ayah, i);
        const wordPicked = hasPart(picked, wordPart);
        const wordPointed = hasPart(pointed, wordPart);
        const pickedLetters = picked.filter(
          (p) => p.wordIndex === i && p.letterIndex !== null,
        );
        const pointedLetters = pointed.filter(
          (p) => p.wordIndex === i && p.letterIndex !== null,
        );

        // A mark is named on the first part it holds in this ayah, so one that
        // reaches into the next ayah is labelled on both.
        const startsHere = marks.filter((m) => {
          const here = partsIn(m, surah, ayah);
          if (!here.length || here.some((p) => p.wordIndex === null)) return false;
          return Math.min(...here.map((p) => p.wordIndex!)) === i;
        });

        // Letters get their own spans only where something needs them —
        // splitting every word would cost shaping and render time for nothing.
        const showLetters =
          letterMarks.length > 0 ||
          pickedLetters.length > 0 ||
          pointedLetters.length > 0 ||
          (interactive && letters);

        const body = showLetters
          ? graphemes(word).map((g, j) => {
              const on = letterMarks.filter((l) => l.letters.includes(j)).map((l) => l.mark);
              const part = oneLetter(surah, ayah, i, j);
              const isPicked = hasPart(picked, part);
              const isPointed = hasPart(pointed, part);
              const content = (
                <span
                  className={cn(isPicked && pickedStyle, isPointed && pointedStyle)}
                  style={styleFor(on)}
                >
                  {g}
                </span>
              );
              return interactive && letters ? (
                <button
                  key={j}
                  type="button"
                  data-word={i}
                  data-letter={j}
                  aria-pressed={isPicked}
                  aria-label={`Word ${i + 1}, letter ${j + 1}`}
                  onClick={(e) => tap(e, part, [])}
                  className="cursor-pointer bg-transparent p-0 font-[inherit] leading-[inherit] text-inherit"
                >
                  {content}
                </button>
              ) : (
                <span key={j}>{content}</span>
              );
            })
          : word;

        return (
          <span key={i}>
            <span className={startsHere.length ? 'relative' : undefined}>
              <span
                data-word={i}
                role={interactive || wordMarks.length ? 'button' : undefined}
                tabIndex={interactive && !letters ? 0 : undefined}
                onClick={
                  interactive && letters
                    ? undefined
                    : (e) => tap(e, wordPart, [...wordMarks, ...letterMarks.map((l) => l.mark)])
                }
                onKeyDown={(e) => {
                  if (interactive && !letters && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    tap(e, wordPart, wordMarks);
                  }
                }}
                className={cn(
                  'transition-colors',
                  interactive && !letters && 'cursor-pointer rounded-md hover:bg-white/10',
                  !interactive && wordMarks.length > 0 && 'cursor-pointer',
                  wordPicked && pickedStyle,
                  wordPointed && pointedStyle,
                )}
                style={styleFor(wordMarks)}
              >
                {body}
              </span>
              {startsHere.length > 0 && (
                // Above the word and out of the line: a label appearing must never
                // push the text along under every student's eyes.
                // Only as wide as the word and clear of its harakat, so labels on
                // neighbouring words never meet and never cover what is taught.
                <span className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center gap-0.5 overflow-hidden whitespace-nowrap text-[0.3em]">
                  {startsHere.map((m) => (
                    <Label key={m.id} mark={m} onMark={onMark} />
                  ))}
                </span>
              )}
            </span>{' '}
          </span>
        );
      })}
      <span className="font-sans text-xl text-neutral-400 sm:text-2xl">{numeral} </span>
      {ayahMarks.length > 0 && (
        <span className="mx-0.5 inline-flex -translate-y-[0.85em] gap-0.5 align-top text-[0.3em]">
          {ayahMarks.map((m) => (
            <Label key={m.id} mark={m} onMark={onMark} />
          ))}
        </span>
      )}
    </span>
  );
}

/** Parts as one string, so memoised ayahs redraw when the pick moves. */
export const partsKeyOf = (parts: readonly TajweedPart[]) =>
  parts.map((p) => `${p.surahNumber}:${p.ayahNumber}:${p.wordIndex}:${p.letterIndex}`).join('|');

/**
 * One ayah of the shared mushaf, as tappable words carrying their marks.
 *
 * Memoised on what it draws, so adding one annotation redraws the one ayah it
 * is on — not the whole surah, which for Al-Baqarah is 286 of these.
 */
export const TajweedAyah = memo(
  AyahImpl,
  (a, b) =>
    a.surah === b.surah &&
    a.ayah === b.ayah &&
    a.text === b.text &&
    a.marksKey === b.marksKey &&
    a.anchor === b.anchor &&
    a.interactive === b.interactive &&
    a.letters === b.letters &&
    a.numeral === b.numeral &&
    partsKeyOf(a.picked) === partsKeyOf(b.picked) &&
    partsKeyOf(a.pointed) === partsKeyOf(b.pointed) &&
    a.onPart === b.onPart &&
    a.onAyah === b.onAyah &&
    a.onMark === b.onMark,
);

/** What `marksKey` is built from: anything that changes how a mark is drawn. */
export function marksKeyOf(marks: readonly AnyTajweedMark[]): string {
  return marks
    .map(
      (m) =>
        `${m.id}:${'version' in m ? m.version : 'live'}:${m.style}:${m.color}:${m.rule}:${
          'outcome' in m ? m.outcome : ''
        }:${m.customLabel}:${partsKeyOf(m.parts)}`,
    )
    .join('|');
}
