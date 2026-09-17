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
  letterAtOffset,
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
 * A marked word is tinted in its rule's colour; a marked letter is underlined
 * in it and never boxed, so two marked letters can sit side by side without
 * their outlines meeting. A live mark is dashed, so a teacher can tell at a
 * glance what will vanish and what is kept.
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

function letterStyle(marks: readonly AnyTajweedMark[]): CSSProperties {
  const mark = marks[0];
  if (!mark) return {};
  const color = markColor(mark);
  return {
    borderBottomColor: color,
    ...(mark.live && { borderBottomStyle: 'dashed' }),
  };
}

/** Every letter carries the underline slot, so marking one never moves the
 *  line: only its colour changes. */
const letterBase = 'relative inline-block border-b-[0.11em] border-b-transparent pb-[0.1em]';
const pickedWord = 'rounded-md bg-signal-400/20 shadow-[0_0_0_2px_rgba(45,212,191,0.85)]';
const pointedWord = 'rounded-md bg-signal-400/15 outline-2 outline-dashed outline-signal-400/80 outline-offset-2';
const pickedLetter = 'bg-signal-400/20 !border-b-signal-400';
const pointedLetter = 'bg-signal-400/15 !border-b-signal-400 !border-b-dashed';

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
  /** A tap picks a letter rather than the whole word. Read when the tap
   *  happens, so switching between them re-renders nothing. */
  lettersRef: RefObject<boolean>;
  /** Draw this ayah's letters as their own elements. Set on the ayah the class
   *  is on and nothing else: a letter then has something to tab to and to aim
   *  at, without splitting — and re-shaping — a whole surah of text. */
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

/**
 * Which letter of a word a tap landed on.
 *
 * The browser already knows — it puts a text caret wherever you click — so the
 * letter is found by asking it, not by giving every letter an element of its
 * own. Splitting a word into elements stops Arabic joining across the seams,
 * which changes every line's width and re-flows the page.
 */
function letterFromEvent(e: MouseEvent, word: string): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return null;
    node = range.startContainer;
    offset = range.startOffset;
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
    if (!pos) return null;
    node = pos.offsetNode;
    offset = pos.offset;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  // The caret can land past the last character when a tap is near the edge.
  return letterAtOffset(word, Math.min(offset, Math.max(0, word.length - 1)));
}

function AyahImpl({
  surah,
  ayah,
  text,
  marks,
  picked,
  pointed,
  lettersRef,
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

  const tap = (e: MouseEvent | KeyboardEvent, word: number, wordMarks: AnyTajweedMark[]) => {
    if (!interactive) {
      if (wordMarks.length) {
        e.stopPropagation();
        onMark(wordMarks[0]);
      }
      return;
    }
    e.stopPropagation();
    // Letters mode asks the browser which letter the tap hit; a keyboard press,
    // which has no point to hit, picks the whole word. A word that is already
    // split — because something is drawn on one of its letters — says which
    // letter was hit outright, and the caret offset inside such a word would
    // index that one letter rather than the word.
    let letter: number | null = null;
    if (lettersRef.current && 'clientX' in e) {
      const hit = (e.target as Element | null)?.closest?.('[data-letter]');
      const named = hit?.getAttribute('data-letter');
      letter =
        named === null || named === undefined
          ? letterFromEvent(e, words[word] ?? '')
          : Number(named);
    }
    onPart(
      letter === null ? wholeWord(surah, ayah, word) : oneLetter(surah, ayah, word, letter),
    );
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
        const letterMarks: { mark: AnyTajweedMark; letters: number[] }[] = [];
        for (const m of marks) {
          const c = coverage(m, surah, ayah, i);
          if (c === 'word') wordMarks.push(m);
          else if (Array.isArray(c)) letterMarks.push({ mark: m, letters: c });
        }
        const wordPart = wholeWord(surah, ayah, i);
        const isPickedWord = hasPart(picked, wordPart);
        const isPointedWord = hasPart(pointed, wordPart);
        const pickedLetters = picked.filter((p) => p.wordIndex === i && p.letterIndex !== null);
        const pointedLetters = pointed.filter((p) => p.wordIndex === i && p.letterIndex !== null);

        // A mark is named on the first part it holds in this ayah, so one that
        // reaches into the next ayah is labelled on both.
        const startsHere = marks.filter((m) => {
          const here = partsIn(m, surah, ayah);
          if (!here.length || here.some((p) => p.wordIndex === null)) return false;
          return Math.min(...here.map((p) => p.wordIndex!)) === i;
        });

        // A word is split where something is drawn on one of its letters —
        // splitting is what lets that letter be underlined on its own — and
        // across the ayah the class is on while letters are being picked. Every
        // other word stays a single run of text, joined the way Arabic joins.
        const splitLetters =
          letterMarks.length > 0 ||
          pickedLetters.length > 0 ||
          pointedLetters.length > 0 ||
          letters;

        const body = splitLetters
          ? graphemes(word).map((g, j) => {
              const on = letterMarks.filter((l) => l.letters.includes(j)).map((l) => l.mark);
              const part = oneLetter(surah, ayah, i, j);
              return (
                <span
                  key={j}
                  data-word={i}
                  data-letter={j}
                  className={cn(
                    letterBase,
                    hasPart(picked, part) && pickedLetter,
                    hasPart(pointed, part) && pointedLetter,
                  )}
                  style={letterStyle(on)}
                >
                  {g}
                </span>
              );
            })
          : word;

        return (
          <span key={i}>
            <span className={startsHere.length ? 'relative' : undefined}>
              <span
                data-word={i}
                role={interactive || wordMarks.length ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={(e) => tap(e, i, [...wordMarks, ...letterMarks.map((l) => l.mark)])}
                onKeyDown={(e) => {
                  if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    tap(e, i, wordMarks);
                  }
                }}
                className={cn(
                  'inline-block transition-colors',
                  interactive && 'cursor-pointer rounded-md hover:bg-white/10',
                  !interactive && wordMarks.length > 0 && 'cursor-pointer',
                  isPickedWord && pickedWord,
                  isPointedWord && pointedWord,
                )}
                style={wordStyle(wordMarks)}
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
 * is on — not the whole surah, which for Al-Baqarah is 286 of these. Whether a
 * tap means a word or a letter is deliberately not among these: it changes
 * nothing that is drawn, so switching costs no render at all.
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

/** One mark's parts, as points measured from the rendered text. */
interface Run {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  dashed: boolean;
}

/** Everything the connector layer draws, and the box it is drawn in. */
interface Drawn {
  w: number;
  h: number;
  runs: Run[];
}

/**
 * Whether two measurements would paint the same picture.
 *
 * Compared rounded to the pixel: a sub-pixel re-layout is not worth a render,
 * and this is what keeps measuring and rendering from chasing each other.
 */
function sameDrawing(a: Drawn, b: Drawn): boolean {
  if (Math.round(a.w) !== Math.round(b.w)) return false;
  if (Math.round(a.h) !== Math.round(b.h)) return false;
  if (a.runs.length !== b.runs.length) return false;
  return a.runs.every((run, i) => {
    const other = b.runs[i];
    return (
      run.id === other.id &&
      run.color === other.color &&
      run.dashed === other.dashed &&
      run.points.length === other.points.length &&
      run.points.every(
        (p, j) =>
          Math.round(p.x) === Math.round(other.points[j].x) &&
          Math.round(p.y) === Math.round(other.points[j].y),
      )
    );
  });
}

/** A curve from one part of a mark to the next, under the line they sit on. */
function curve(points: { x: number; y: number }[], color: string, dashed: boolean) {
  const paths: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    // Different lines: a curve between them would cross the text between.
    if (Math.abs(a.y - b.y) > 6) continue;
    const drop = Math.min(16, Math.max(8, Math.abs(b.x - a.x) / 4));
    paths.push(
      `M ${a.x} ${a.y + 2} C ${a.x} ${a.y + drop}, ${b.x} ${b.y + drop}, ${b.x} ${b.y + 2}`,
    );
  }
  return paths.map((d, i) => (
    <path
      key={i}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      {...(dashed ? { strokeDasharray: '4 4' } : {})}
    />
  ));
}

/**
 * The letters of one mark, joined by a line under the text.
 *
 * A rule that holds a letter here and a letter three words later is one mark,
 * and nothing in the text says so on its own — the curve is what makes a pair
 * read as a pair. Positions are measured from the rendered text, because only
 * the browser knows where a shaped Arabic letter ended up.
 */
export function TajweedLinks({
  containerRef,
  marks,
  pointing,
  colors,
}: {
  containerRef: RefObject<HTMLElement | null>;
  marks: readonly AnyTajweedMark[];
  pointing: readonly TajweedPart[];
  colors?: Partial<Record<TajweedRuleGroupKey, string>>;
}) {
  const [drawn, setDrawn] = useState<Drawn>({ w: 0, h: 0, runs: [] });

  const joined = useMemo(
    () => [
      ...marks
        .filter((m) => m.parts.length > 1)
        .map((m) => ({ id: m.id, parts: m.parts, color: markColor(m, colors), dashed: !!m.live })),
      ...(pointing.length > 1
        ? [{ id: 'pointing', parts: pointing, color: POINT, dashed: true }]
        : []),
    ],
    [marks, pointing, colors],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const runs: Run[] = joined.map((run) => ({
      id: run.id,
      color: run.color,
      dashed: run.dashed,
      points: run.parts
        .map((p) => {
          const selector =
            p.wordIndex === null
              ? `[data-ayah="${p.ayahNumber}"]`
              : p.letterIndex === null
                ? `[data-ayah="${p.ayahNumber}"] [data-word="${p.wordIndex}"]`
                : `[data-ayah="${p.ayahNumber}"] [data-word="${p.wordIndex}"][data-letter="${p.letterIndex}"]`;
          return container.querySelector(selector);
        })
        .filter((el): el is Element => !!el)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.left - bounds.left + r.width / 2,
            y: r.bottom - bounds.top,
          };
        }),
    }));
    // Only a real change is worth a render. This component watches the very
    // element it draws into, so handing back a fresh object for an unchanged
    // measurement would set the observer and the render spinning against each
    // other — and a wedged tab in the middle of a class is unforgivable.
    const next = { w: bounds.width, h: bounds.height, runs };
    setDrawn((prev) => (sameDrawing(prev, next) ? prev : next));
  }, [containerRef, joined]);

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

  if (!drawn.runs.some((r) => r.points.length > 1)) return null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={drawn.w}
      height={drawn.h}
    >
      {drawn.runs.map((run) => (
        <g key={run.id}>{curve(run.points, run.color, run.dashed)}</g>
      ))}
    </svg>
  );
}
