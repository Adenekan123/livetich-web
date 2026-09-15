'use client';

import { memo, useMemo, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { TAJWEED_RULES } from '@/lib/realtime-contract';
import {
  coverage,
  graphemes,
  splitWords,
  TAJWEED_OUTCOMES,
  TAJWEED_SUGGESTED_COLORS,
  type AnyTajweedMark,
  type TajweedSelectionState,
} from '@/lib/tajweed';
import { cn } from '@/lib/ui';

const OUTCOME_COLORS: Record<string, string> = {
  CORRECT: '#16a34a',
  REPEAT: '#ca8a04',
  PRONUNCIATION: '#dc2626',
  NOTE: '#64748b',
};

export function markColor(m: AnyTajweedMark): string {
  if (m.color) return m.color;
  if (m.rule) return TAJWEED_SUGGESTED_COLORS[m.rule];
  return ('outcome' in m && m.outcome && OUTCOME_COLORS[m.outcome]) || '#64748b';
}

export function markLabel(m: AnyTajweedMark): string {
  const rule =
    m.rule === 'custom' ? (m.customLabel ?? 'Note') : m.rule ? TAJWEED_RULES[m.rule].label : null;
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

const selectedWord = 'rounded-md bg-signal-400/25 shadow-[0_0_0_2px_rgba(45,212,191,0.85)]';

export interface TajweedAyahProps {
  surah: number;
  ayah: number;
  text: string;
  /** Marks on this ayah only. */
  marks: readonly AnyTajweedMark[];
  /** Changes whenever anything about `marks` that is drawn changes. */
  marksKey: string;
  /** The selection, when it is in this ayah. */
  selection: TajweedSelectionState | null;
  anchor: boolean;
  /** The teacher is annotating: words are tap targets. */
  interactive: boolean;
  /** "﴿٧﴾" */
  numeral: string;
  onWord: (ayah: number, word: number, extend: boolean) => void;
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
      style={{ color, backgroundColor: tint(color, 0.16) }}
    >
      {markLabel(mark)}
    </span>
  );
}

function AyahImpl({
  ayah,
  text,
  marks,
  selection,
  anchor,
  interactive,
  numeral,
  onWord,
  onAyah,
  onMark,
}: TajweedAyahProps) {
  const words = useMemo(() => splitWords(text), [text]);
  const ayahMarks = marks.filter((m) => m.selection === 'AYAH');

  const pick = (e: MouseEvent | KeyboardEvent, word: number, wordMarks: AnyTajweedMark[]) => {
    if (interactive) {
      e.stopPropagation();
      onWord(ayah, word, e.shiftKey || e.metaKey || e.ctrlKey);
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
        selection?.selection === 'AYAH' && selectedWord,
      )}
      style={styleFor(ayahMarks)}
    >
      {words.map((word, i) => {
        const wordMarks: AnyTajweedMark[] = [];
        const letterMarks: { mark: AnyTajweedMark; from: number; to: number }[] = [];
        for (const m of marks) {
          const c = coverage(m, i);
          if (c === 'word') wordMarks.push(m);
          else if (c && c !== 'ayah') letterMarks.push({ mark: m, ...c });
        }
        const inSelection =
          selection &&
          selection.selection !== 'AYAH' &&
          selection.wordStart !== null &&
          i >= selection.wordStart &&
          i <= (selection.wordEnd ?? selection.wordStart);
        const selectingLetters = inSelection && selection.selection === 'LETTERS';
        const endingHere = marks.filter(
          (m) => m.selection !== 'AYAH' && (m.wordEnd ?? m.wordStart) === i,
        );

        // Letters are only split into their own spans where something needs
        // them — splitting every word would cost shaping and render time for
        // nothing.
        const body =
          letterMarks.length || selectingLetters
            ? graphemes(word).map((g, j) => {
                const on = letterMarks.filter((l) => j >= l.from && j <= l.to).map((l) => l.mark);
                const picked =
                  selectingLetters &&
                  selection.letterStart !== null &&
                  j >= selection.letterStart &&
                  j <= (selection.letterEnd ?? selection.letterStart);
                return (
                  <span key={j} className={cn(picked && selectedWord)} style={styleFor(on)}>
                    {g}
                  </span>
                );
              })
            : word;

        return (
          <span key={i}>
            <span className={endingHere.length ? 'relative' : undefined}>
            <span
              data-word={i}
              role={interactive || wordMarks.length ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={(e) => pick(e, i, [...wordMarks, ...letterMarks.map((l) => l.mark)])}
              onKeyDown={(e) => {
                if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  pick(e, i, wordMarks);
                }
              }}
              className={cn(
                'transition-colors',
                interactive && 'cursor-pointer rounded-md hover:bg-white/10',
                !interactive && wordMarks.length > 0 && 'cursor-pointer',
                inSelection && !selectingLetters && selectedWord,
              )}
              style={styleFor(wordMarks)}
            >
              {body}
            </span>
            {endingHere.length > 0 && (
              // Above the word and out of the line: a label appearing must never
              // push the text along under every student's eyes.
              // Only as wide as the word and clear of its harakat, so labels on
              // neighbouring words never meet and never cover what is taught.
              <span className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center gap-0.5 overflow-hidden whitespace-nowrap text-[0.3em]">
                {endingHere.map((m) => (
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

const selectionKey = (s: TajweedSelectionState | null) =>
  s ? `${s.selection}:${s.wordStart}:${s.wordEnd}:${s.letterStart}:${s.letterEnd}` : '';

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
    a.numeral === b.numeral &&
    selectionKey(a.selection) === selectionKey(b.selection) &&
    a.onWord === b.onWord &&
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
        }:${m.customLabel}`,
    )
    .join('|');
}
