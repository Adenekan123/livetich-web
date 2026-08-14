'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PiCaretLeft,
  PiCaretRight,
  PiCaretDown,
  PiCheck,
  PiBookOpenText,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import type { Surah } from '@/lib/types';

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
}: {
  surah: number;
  ayah: number;
  isInstructor: boolean;
  /** Instructor-only: turn the shared page for everyone. */
  onNavigate: (surah: number, ayah: number) => void;
}) {
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
  useEffect(() => {
    if (!text || text.number !== surah) return;
    const el = ayahRefs.current.get(ayah);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

      {/* The page */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
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
            <p className="font-quran text-right text-3xl leading-[2.6] text-neutral-50 sm:text-[2.6rem] sm:leading-[2.4]">
              {text.ayahs.map((verse, i) => {
                const n = i + 1;
                const isAnchor = n === ayah;
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
    </div>
  );
}
