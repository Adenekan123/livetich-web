'use client';

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import type { TajweedPart, TajweedRuleGroupKey } from '@/lib/realtime-contract';
import {
  coverage,
  graphemes,
  hasPart,
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

/** What a pick and a pointing outline are drawn in, on either screen. */
const POINT = '#2dd4bf';

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

/**
 * A marked word is tinted in its rule's colour. A marked letter is not styled
 * here at all: it is underlined by the overlay, which measures where the letter
 * sits rather than giving it an element of its own. The text of the Qur'an is
 * never cut into pieces — Arabic joins, and a word split into elements stops
 * joining, re-wrapping every line around it.
 */
function wordStyle(marks: readonly AnyTajweedMark[]): CSSProperties {
  const mark = marks[0];
  if (!mark) return {};
  const color = markColor(mark);
  return {
    backgroundColor: tint(color, 0.25),
    borderRadius: '0.3em',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    ...(mark.live && {
      outline: `2px dashed ${color}`,
      outlineOffset: '2px',
    }),
  };
}

const pickedWord = 'rounded-md bg-signal-400/20 shadow-[0_0_0_2px_rgba(45,212,191,0.85)]';
const pointedWord =
  'rounded-md bg-signal-400/15 outline-2 outline-dashed outline-signal-400/80 outline-offset-2';

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
  anchor: boolean;
  /** The teacher is annotating: words are tap targets. */
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

  const tap = (e: MouseEvent | KeyboardEvent, word: number, wordMarks: AnyTajweedMark[]) => {
    if (!interactive) {
      if (wordMarks.length) {
        e.stopPropagation();
        onMark(wordMarks[0]);
      }
      return;
    }
    e.stopPropagation();
    // A tap in the text is always a word. Narrowing it to single letters
    // happens in the panel below, where the word is laid out letter by letter
    // and there is room to aim.
    onPart(wholeWord(surah, ayah, word));
  };

  return (
    <span
      data-ayah={ayah}
      onClick={!interactive && onAyah ? () => onAyah(ayah) : undefined}
      className={cn(
        'rounded-lg px-1 transition-colors',
        !interactive && onAyah && 'cursor-pointer',
        anchor ? 'bg-white/15 text-white' : !interactive && 'hover:bg-white/5',
        ayahPicked && pickedWord,
      )}
      style={wordStyle(ayahMarks)}
    >
      {words.map((word, i) => {
        const wordMarks: AnyTajweedMark[] = [];
        const letterMarks: AnyTajweedMark[] = [];
        for (const m of marks) {
          const c = coverage(m, surah, ayah, i);
          if (c === 'word') wordMarks.push(m);
          else if (Array.isArray(c)) letterMarks.push(m);
        }
        const wordPart = wholeWord(surah, ayah, i);
        const isPickedWord = hasPart(picked, wordPart);
        const isPointedWord = hasPart(pointed, wordPart);

        // A mark is named on the first part it holds in this ayah, so one that
        // reaches into the next ayah is labelled on both.
        const startsHere = marks.filter((m) => {
          const here = partsIn(m, surah, ayah);
          if (!here.length || here.some((p) => p.wordIndex === null)) return false;
          return Math.min(...here.map((p) => p.wordIndex!)) === i;
        });

        return (
          <span key={i}>
            <span className={startsHere.length ? 'relative' : undefined}>
              <span
                data-word={i}
                role={interactive || wordMarks.length || letterMarks.length ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={(e) => tap(e, i, [...wordMarks, ...letterMarks])}
                onKeyDown={(e) => {
                  if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    tap(e, i, wordMarks);
                  }
                }}
                className={cn(
                  'inline-block transition-colors',
                  interactive && 'cursor-pointer rounded-md hover:bg-white/10',
                  !interactive && (wordMarks.length > 0 || letterMarks.length > 0) && 'cursor-pointer',
                  isPickedWord && pickedWord,
                  isPointedWord && pointedWord,
                )}
                style={wordStyle(wordMarks)}
              >
                {word}
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

// ---- the overlay -------------------------------------------------------

/** A letter's underline, measured from the rendered text. */
interface Underline {
  x1: number;
  x2: number;
  y: number;
}

/** One mark as it is drawn: a line under each letter it holds, and a curve
 *  joining them so a pair reads as a pair. */
interface Run {
  id: string;
  underlines: Underline[];
  joins: { x: number; y: number }[];
  color: string;
  dashed: boolean;
}

interface Drawn {
  w: number;
  h: number;
  runs: Run[];
}

const near = (a: number, b: number) => Math.round(a) === Math.round(b);

/**
 * Whether two measurements would paint the same picture.
 *
 * Compared rounded to the pixel: a sub-pixel re-layout is not worth a render,
 * and this is what keeps measuring and rendering from chasing each other.
 */
function sameDrawing(a: Drawn, b: Drawn): boolean {
  if (!near(a.w, b.w) || !near(a.h, b.h)) return false;
  if (a.runs.length !== b.runs.length) return false;
  return a.runs.every((run, i) => {
    const other = b.runs[i];
    return (
      run.id === other.id &&
      run.color === other.color &&
      run.dashed === other.dashed &&
      run.underlines.length === other.underlines.length &&
      run.joins.length === other.joins.length &&
      run.underlines.every(
        (u, j) =>
          near(u.x1, other.underlines[j].x1) &&
          near(u.x2, other.underlines[j].x2) &&
          near(u.y, other.underlines[j].y),
      ) &&
      run.joins.every(
        (p, j) => near(p.x, other.joins[j].x) && near(p.y, other.joins[j].y),
      )
    );
  });
}

/**
 * Where one letter of a word sits on the page.
 *
 * The word is a single run of text — it has to be, or Arabic stops joining —
 * so the letter has no element to measure. A Range over exactly the characters
 * that letter is made of does have a box, and that is what gets underlined.
 */
function letterBox(word: Element, text: string, letterIndex: number): DOMRect | null {
  const node = word.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const letters = graphemes(text);
  if (letterIndex < 0 || letterIndex >= letters.length) return null;
  let start = 0;
  for (let i = 0; i < letterIndex; i++) start += letters[i].length;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + letters[letterIndex].length);
  const box = range.getBoundingClientRect();
  range.detach?.();
  return box.width || box.height ? box : null;
}

/**
 * Everything drawn over the text rather than in it: the underline under each
 * marked letter, and the curve joining the letters of one mark.
 *
 * All of it is measured from the rendered page, because only the browser knows
 * where a shaped Arabic letter ended up — and measuring is what lets the text
 * itself stay one unbroken, properly joined run of letters.
 */
export function TajweedOverlay({
  containerRef,
  marks,
  pointing,
  textOf,
  colors,
}: {
  containerRef: RefObject<HTMLElement | null>;
  marks: readonly AnyTajweedMark[];
  pointing: readonly TajweedPart[];
  /** The text of an ayah, for working out where a letter starts. */
  textOf: (surah: number, ayah: number) => string | null;
  colors?: Partial<Record<TajweedRuleGroupKey, string>>;
}) {
  const [drawn, setDrawn] = useState<Drawn>({ w: 0, h: 0, runs: [] });

  const wanted = useMemo(
    () => [
      ...marks.map((m) => ({
        id: m.id,
        parts: m.parts,
        color: markColor(m, colors),
        dashed: !!m.live,
      })),
      ...(pointing.length
        ? [{ id: 'pointing', parts: pointing, color: POINT, dashed: true }]
        : []),
    ],
    [marks, pointing, colors],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();

    const runs: Run[] = wanted.map((run) => {
      const underlines: Underline[] = [];
      const joins: { x: number; y: number }[] = [];
      for (const part of run.parts) {
        if (part.wordIndex === null) continue;
        const word = container.querySelector(
          `[data-ayah="${part.ayahNumber}"] [data-word="${part.wordIndex}"]`,
        );
        if (!word) continue;
        let box: DOMRect | null = null;
        if (part.letterIndex === null) {
          // A whole word is tinted in the text itself; only its position is
          // needed here, to join it to the next part.
          box = word.getBoundingClientRect();
        } else {
          const verse = textOf(part.surahNumber, part.ayahNumber);
          const text = verse ? (splitWords(verse)[part.wordIndex] ?? '') : '';
          box = text ? letterBox(word, text, part.letterIndex) : null;
          if (box) {
            underlines.push({
              x1: box.left - bounds.left,
              x2: box.right - bounds.left,
              y: box.bottom - bounds.top,
            });
          }
        }
        if (box) {
          joins.push({
            x: box.left - bounds.left + box.width / 2,
            y: box.bottom - bounds.top,
          });
        }
      }
      return { id: run.id, color: run.color, dashed: run.dashed, underlines, joins };
    });

    // Only a real change is worth a render. This watches the very element it
    // draws into, so returning a fresh object for an unchanged measurement
    // would set the observer and the render spinning against each other.
    const next = { w: bounds.width, h: bounds.height, runs };
    setDrawn((prev) => (sameDrawing(prev, next) ? prev : next));
  }, [containerRef, wanted, textOf]);

  // After the text has been laid out, and again whenever it could have moved:
  // the Uthmani webfont swapping in re-flows every line it touches.
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // A burst of layout events costs one measurement, on the next frame.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    void document.fonts?.ready.then(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, measure]);

  const anything = drawn.runs.some((r) => r.underlines.length || r.joins.length > 1);
  if (!anything) return null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={drawn.w}
      height={drawn.h}
    >
      {drawn.runs.map((run) => (
        <g key={run.id}>
          {run.underlines.map((u, i) => (
            <line
              key={`u${i}`}
              x1={u.x1}
              x2={u.x2}
              y1={u.y + 2}
              y2={u.y + 2}
              stroke={run.color}
              strokeWidth={3}
              strokeLinecap="round"
              {...(run.dashed ? { strokeDasharray: '4 4' } : {})}
            />
          ))}
          {run.joins.slice(1).map((b, i) => {
            const a = run.joins[i];
            // Different lines: a curve between them would cross the text.
            if (Math.abs(a.y - b.y) > 6) return null;
            const drop = Math.min(16, Math.max(8, Math.abs(b.x - a.x) / 4));
            return (
              <path
                key={`j${i}`}
                d={`M ${a.x} ${a.y + 3} C ${a.x} ${a.y + drop}, ${b.x} ${b.y + drop}, ${b.x} ${b.y + 3}`}
                fill="none"
                stroke={run.color}
                strokeWidth={2}
                strokeLinecap="round"
                {...(run.dashed ? { strokeDasharray: '4 4' } : {})}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}
