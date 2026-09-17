'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PiCaretLeft,
  PiCaretRight,
  PiCaretDown,
  PiCheck,
  PiBookOpenText,
  PiEyeBold,
  PiEyeSlashBold,
  PiListBulletsBold,
  PiPencilLineBold,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import type { RoomUser } from '@/lib/realtime-contract';
import {
  ayahKey,
  graphemes,
  partsIn,
  splitWords,
  type AnyTajweedMark,
} from '@/lib/tajweed';
import type { TajweedPart } from '@/lib/realtime-contract';
import type { Surah } from '@/lib/types';
import { marksKeyOf, TajweedAyah, TajweedLinks } from './tajweed-ayah';
import {
  TajweedLegend,
  TajweedMarkCard,
  TajweedNotice,
  TajweedToolbar,
} from './tajweed-toolbar';
import type { TajweedApi, TajweedMode } from './use-tajweed';

const NO_MARKS: readonly AnyTajweedMark[] = [];

/** Standard basmalah, shown as a surah header (every surah opens with it
 *  except At-Tawbah; Al-Fatihah already carries it as ayah 1). */
const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

interface SurahText {
  number: number;
  arabicName: string;
  transliteration: string;
  englishName: string;
  ayahs: string[];
}

async function authFetch(path: string) {
  const token = await getRealtimeToken();
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
}

/** 7 -> "٧" (Arabic-Indic), for the ayah-end markers. */
function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * A dark, searchable surah picker — the native <select> rendered a cramped,
 * light-on-dark list of 114 items that was hard to scan and felt broken. This
 * is a styled popover: type to filter, click to jump.
 */
function SurahPicker({
  surahs,
  value,
  onSelect,
}: {
  surahs: Surah[];
  value: number;
  onSelect: (surah: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const current = surahs.find((s) => s.number === value);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        String(s.number) === q ||
        s.transliteration.toLowerCase().includes(q) ||
        s.englishName.toLowerCase().includes(q),
    );
  }, [surahs, query]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
        }}
        aria-label="Choose surah"
        aria-expanded={open}
        className="flex h-8 min-w-[9.5rem] items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-white transition hover:bg-white/10 focus:border-signal-500 focus:outline-none"
      >
        <span className="truncate">
          {current ? `${current.number}. ${current.transliteration}` : 'Surah'}
        </span>
        <PiCaretDown
          className={cn('h-3.5 w-3.5 shrink-0 text-neutral-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-signal-500 focus:outline-none"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-2.5 py-3 text-center text-xs text-neutral-500">
                No match
              </li>
            )}
            {filtered.map((s) => {
              const active = s.number === value;
              return (
                <li key={s.number}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s.number);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                      active
                        ? 'bg-signal-500/15 text-signal-200'
                        : 'text-neutral-200 hover:bg-white/10',
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="tabular-nums text-neutral-500">
                        {s.number}.
                      </span>{' '}
                      {s.transliteration}
                      <span className="text-neutral-500"> · {s.englishName}</span>
                    </span>
                    <span className="font-quran shrink-0 text-sm text-neutral-400">
                      {s.arabicName}
                    </span>
                    {active && <PiCheck className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The shared mushaf. The instructor turns the page (surah + ayah) and it
 * broadcasts to every student over the room socket; students follow along,
 * the current ayah highlighted and scrolled into view. Arabic is Uthmani
 * (Tanzil), rendered RTL in the Amiri Quran face.
 */
export function QuranReader({
  surah,
  ayah,
  isInstructor,
  onNavigate,
  tajweed = null,
  students = [],
  tajweedModes,
  startAnnotating = false,
}: {
  surah: number;
  ayah: number;
  isInstructor: boolean;
  /** Instructor-only: turn the shared page for everyone. */
  onNavigate: (surah: number, ayah: number) => void;
  /** Tajweed annotations on the text. Absent = the plain mushaf. */
  tajweed?: TajweedApi | null;
  /** Students in the room, for recording a correction against one of them. */
  students?: RoomUser[];
  /** The Tajweed modes on offer here (all of them in class). */
  tajweedModes?: TajweedMode[];
  /** Open already marking — for preparing a lesson, where that is the point. */
  startAnnotating?: boolean;
}) {
  const [annotating, setAnnotating] = useState(startAnnotating);
  const [openMark, setOpenMark] = useState<AnyTajweedMark | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  // Handlers handed to every ayah must stay the same function across renders,
  // or memoising the ayahs saves nothing; they read the latest values here.
  const navRef = useRef(onNavigate);
  const annotatingRef = useRef(annotating);
  const tajweedRef = useRef(tajweed);
  // Whether a tap means a word or a letter is read when the tap happens, not
  // rendered: switching between them changes nothing on the page, so it costs
  // no re-render of the text at all.
  const lettersRef = useRef(false);
  useEffect(() => {
    navRef.current = onNavigate;
    annotatingRef.current = annotating;
    tajweedRef.current = tajweed;
    lettersRef.current = tajweed?.selection.letters ?? false;
  });
  // The mushaf is what the connector curves are measured against.
  const mushafRef = useRef<HTMLParagraphElement>(null);
  const [text, setText] = useState<SurahText | null>(null);
  const [catalog, setCatalog] = useState<Surah[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<number, SurahText>>(new Map());
  const ayahRefs = useRef<Map<number, HTMLSpanElement | null>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Instructor needs the full catalog for the surah picker + ayah counts
  // (rollover between surahs). Students render from the surah payload alone.
  useEffect(() => {
    if (!isInstructor) return;
    void authFetch('/quran/surahs')
      .then((r) => (r.ok ? r.json() : { surahs: [] }))
      .then((d: { surahs: Surah[] }) => setCatalog(d.surahs))
      .catch(() => {});
  }, [isInstructor]);

  // Load (and cache) the current surah's verses.
  useEffect(() => {
    const cached = cache.current.get(surah);
    if (cached) {
      setText(cached);
      return;
    }
    let live = true;
    setError(null);
    void authFetch(`/quran/surahs/${surah}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load surah');
        return (await r.json()) as SurahText;
      })
      .then((d) => {
        cache.current.set(surah, d);
        if (live) setText(d);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed'));
    return () => {
      live = false;
    };
  }, [surah]);

  // Follow the instructor: scroll the anchored ayah into view when it changes.
  //
  // Twice, on purpose. The Uthmani face is a large webfont, and every line it
  // reflows when it swaps in moves the page under whatever we just scrolled to
  // — so the first scroll lands on roughly the right ayah and then drifts off
  // by several. The second one, once the fonts have settled, is the one that
  // actually holds.
  useEffect(() => {
    if (!text || text.number !== surah) return;
    let live = true;
    const anchor = (behavior: ScrollBehavior) => {
      if (!live) return;
      // Annotated ayahs are memoised components without a ref of their own;
      // they carry data-ayah instead.
      (
        ayahRefs.current.get(ayah) ??
        scrollRef.current?.querySelector<HTMLElement>(`[data-ayah="${ayah}"]`)
      )?.scrollIntoView({ behavior, block: 'center' });
    };
    anchor('smooth');
    void document.fonts?.ready.then(() => anchor('auto'));
    return () => {
      live = false;
    };
  }, [surah, ayah, text]);

  const ayahCount = text?.ayahs.length ?? 0;
  const showBismillah = surah !== 1 && surah !== 9;

  const go = useCallback(
    (nextSurah: number, nextAyah: number) => {
      if (!isInstructor) return;
      onNavigate(nextSurah, nextAyah);
    },
    [isInstructor, onNavigate],
  );

  const catalogCount = useMemo(
    () => new Map(catalog.map((s) => [s.number, s.ayahCount])),
    [catalog],
  );

  const canAnnotate = !!tajweed && isInstructor;
  const marking = canAnnotate && annotating;
  const selected = tajweed?.selection.parts ?? [];
  // The teacher's own pick is already drawn as `picked`; the outline is for
  // everyone else's screen, so it is never drawn twice for the one pointing.
  const pointed = tajweed && !isInstructor ? tajweed.pointing : [];

  /**
   * A tap on a word or a letter while annotating: it adds what was tapped, or
   * drops it if it was already picked — in any ayah. The shared page follows to
   * the ayah being marked, so the class is looking where the teacher points.
   */
  const onPart = useCallback(
    (part: TajweedPart) => {
      setOpenMark(null);
      tajweedRef.current?.pickPart(part);
      navRef.current(surah, part.ayahNumber);
    },
    [surah],
  );

  /** Names a surah, for saying where a mark sits. */
  const surahName = useCallback(
    (n: number) =>
      (n === surah ? text?.transliteration : catalog.find((s) => s.number === n)?.transliteration) ??
      `Surah ${n}`,
    [surah, text, catalog],
  );

  /** The text of one ayah, for showing what is picked. Only the surah on
   *  screen is loaded, and it is the only one that can be picked in. */
  const ayahText = useCallback(
    (n: number, a: number) => (n === surah ? (text?.ayahs[a - 1] ?? null) : null),
    [surah, text],
  );

  /** The Arabic some parts point at, read back off the mushaf — so the class
   *  is told what was marked in the words themselves, not a reference. */
  const partsText = useCallback(
    (parts: readonly TajweedPart[]) =>
      parts
        .map((p) => {
          const verse = p.surahNumber === surah ? text?.ayahs[p.ayahNumber - 1] : null;
          if (!verse || p.wordIndex === null) return '';
          const word = splitWords(verse)[p.wordIndex] ?? '';
          return p.letterIndex === null ? word : (graphemes(word)[p.letterIndex] ?? '');
        })
        .filter(Boolean)
        .join(' '),
    [surah, text],
  );

  const onAyahTap = useCallback(
    (n: number) => {
      if (isInstructor) navRef.current(surah, n);
    },
    [isInstructor, surah],
  );

  const onMark = useCallback((mark: AnyTajweedMark) => {
    setOpenMark(mark);
  }, []);

  const step = (dir: -1 | 1) => {
    const next = ayah + dir;
    if (next >= 1 && next <= ayahCount) return go(surah, next);
    if (dir === 1 && surah < 114) return go(surah + 1, 1);
    if (dir === -1 && surah > 1) {
      // Land on the last ayah of the previous surah (from the catalog count).
      const prevLen = catalogCount.get(surah - 1) ?? 1;
      return go(surah - 1, prevLen);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-neutral-100">
      {/* Surah header / instructor controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <PiBookOpenText className="h-4 w-4 text-neutral-400" />
          {text ? (
            <>
              {text.transliteration}
              <span className="text-neutral-500">·</span>
              <span className="font-normal text-neutral-400">
                {text.englishName}
              </span>
            </>
          ) : (
            'Mushaf'
          )}
        </span>

        {tajweed && (
          <div className="flex items-center gap-1">
            {canAnnotate && (
              <button
                type="button"
                aria-pressed={annotating}
                onClick={() => {
                  setAnnotating((v) => !v);
                  tajweed.clearSelection();
                  setOpenMark(null);
                }}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition',
                  annotating
                    ? 'border-signal-500/60 bg-signal-600 text-white'
                    : 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10',
                )}
              >
                <PiPencilLineBold className="h-3.5 w-3.5" aria-hidden />
                Tajweed
              </button>
            )}
            {tajweed.legend.length > 0 && (
              <button
                type="button"
                aria-pressed={legendOpen}
                aria-label="Tajweed legend"
                title="Legend"
                onClick={() => setLegendOpen((v) => !v)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 transition hover:bg-white/10',
                  legendOpen && 'bg-white/10 text-white',
                )}
              >
                <PiListBulletsBold className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-pressed={tajweed.hideAll}
              aria-label={tajweed.hideAll ? 'Show Tajweed marks' : 'Hide Tajweed marks'}
              title={tajweed.hideAll ? 'Show marks' : 'Hide marks'}
              onClick={() => (tajweed.hideAll ? tajweed.showAll() : tajweed.setHideAll(true))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 transition hover:bg-white/10"
            >
              {tajweed.hideAll ? (
                <PiEyeSlashBold className="h-4 w-4" />
              ) : (
                <PiEyeBold className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {isInstructor ? (
          <div className="ml-auto flex items-center gap-1.5">
            <SurahPicker
              surahs={catalog}
              value={surah}
              onSelect={(n) => go(n, 1)}
            />
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
              <button
                onClick={() => step(-1)}
                aria-label="Previous ayah"
                className="grid h-8 w-8 place-items-center rounded-l-lg text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                <PiCaretRight className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5rem] px-1 text-center text-xs font-medium tabular-nums text-neutral-300">
                {ayah}
                {ayahCount ? ` / ${ayahCount}` : ''}
              </span>
              <button
                onClick={() => step(1)}
                aria-label="Next ayah"
                className="grid h-8 w-8 place-items-center rounded-r-lg text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                <PiCaretLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <span className="ml-auto text-xs text-neutral-500">
            Ayah {ayah}
            {ayahCount ? ` / ${ayahCount}` : ''} · following instructor
          </span>
        )}
      </div>

      {/* What the class is told: the instructor pointing, then the rule they
          chose. Only for the people being taught — the instructor already
          knows what they just marked. */}
      {tajweed && !tajweed.canEdit && (
        <TajweedNotice
          pointing={tajweed.pointing}
          mark={tajweed.announced}
          textOf={partsText}
          surahName={surahName}
          colors={tajweed.prefs.colors}
          onDismiss={tajweed.dismissAnnounced}
        />
      )}

      {/* The page */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {tajweed && legendOpen && (
          <div className="pointer-events-none sticky top-0 z-10 flex justify-end">
            <div className="pointer-events-auto">
              <TajweedLegend entries={tajweed.legend} />
            </div>
          </div>
        )}
        {tajweed?.loadError && (
          <p className="mx-auto mb-4 max-w-md rounded-lg bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
            {tajweed.loadError}
          </p>
        )}
        {error && (
          <p className="mx-auto max-w-md rounded-lg bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-300">
            {error}
          </p>
        )}
        {!text && !error && (
          <p className="pt-10 text-center text-sm text-neutral-500">Loading…</p>
        )}
        {text && (
          <div className="mx-auto max-w-3xl" dir="rtl" lang="ar">
            {showBismillah && (
              <p className="font-quran mb-6 text-center text-2xl leading-loose text-neutral-300 sm:text-3xl">
                {BISMILLAH}
              </p>
            )}
            <p
              ref={mushafRef}
              className="font-quran relative text-right text-3xl leading-[2.6] text-neutral-50 sm:text-[2.6rem] sm:leading-[2.4]"
            >
              {tajweed && (
                // The letters of one mark, joined under the line: a rule that
                // holds a letter here and another three words later is one
                // mark, and only the curve says so.
                <TajweedLinks
                  containerRef={mushafRef}
                  marks={tajweed.visible}
                  pointing={isInstructor ? tajweed.selection.parts : tajweed.pointing}
                  colors={tajweed.prefs.colors}
                />
              )}
              {text.ayahs.map((verse, i) => {
                const n = i + 1;
                const isAnchor = n === ayah;
                if (tajweed) {
                  const marks = tajweed.index.get(ayahKey(surah, n)) ?? NO_MARKS;
                  return (
                    <TajweedAyah
                      key={n}
                      surah={surah}
                      ayah={n}
                      text={verse}
                      marks={marks}
                      marksKey={marksKeyOf(marks)}
                      picked={partsIn({ parts: selected }, surah, n)}
                      pointed={partsIn({ parts: pointed }, surah, n)}
                      lettersRef={lettersRef}
                      // The verse the class is on and the ones either side of
                      // it: a rule that crosses an ayah boundary lives in the
                      // next verse, so its letters have to be reachable too.
                      // Everything further off stays unsplit, and is picked by
                      // where the tap lands instead.
                      letters={
                        marking && tajweed.selection.letters && Math.abs(n - ayah) <= 1
                      }
                      anchor={isAnchor}
                      interactive={marking}
                      numeral={`﴿${toArabicNumerals(n)}﴾`}
                      onPart={onPart}
                      onAyah={isInstructor ? onAyahTap : null}
                      onMark={onMark}
                    />
                  );
                }
                return (
                  <span
                    key={n}
                    ref={(el) => {
                      ayahRefs.current.set(n, el);
                    }}
                    onClick={() => go(surah, n)}
                    className={cn(
                      'rounded-lg px-1 transition-colors',
                      isInstructor && 'cursor-pointer',
                      isAnchor
                        ? 'bg-white/15 text-white'
                        : 'hover:bg-white/5',
                    )}
                  >
                    {verse}
                    <span className="font-sans text-xl text-neutral-400 sm:text-2xl">
                      {' '}
                      ﴿{toArabicNumerals(n)}﴾{' '}
                    </span>
                  </span>
                );
              })}
            </p>
          </div>
        )}
      </div>

      {marking && tajweed && (
        // Capped and scrolling on its own, so on a phone the text being taught
        // keeps at least half the reader instead of two lines of it.
        <div className="max-h-[55%] shrink-0 overflow-y-auto">
          <TajweedToolbar
            api={tajweed}
            students={students}
            surahName={surahName}
            ayahText={ayahText}
            modes={tajweedModes}
          />
        </div>
      )}
      {openMark && (
        <TajweedMarkCard
          mark={openMark}
          surahName={surahName}
          onClose={() => setOpenMark(null)}
        />
      )}
    </div>
  );
}
