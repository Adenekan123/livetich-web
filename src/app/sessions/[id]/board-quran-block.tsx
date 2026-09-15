'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { ayahKey, type AnyTajweedMark } from '@/lib/tajweed';
import { marksKeyOf, TajweedAyah } from './tajweed-ayah';
import type { TajweedApi } from './use-tajweed';

/**
 * A block of ayahs on the whiteboard.
 *
 * It is stored as an ordinary embeddable, so it moves, resizes and syncs like a
 * document on the board. Its link is only an address for the block: `.invalid`
 * is reserved and can never resolve, so it cannot be mistaken for — or opened
 * as — a real page. The text comes from the canonical Qur'an, and the marks
 * from the class's Tajweed annotations; the block draws both and changes
 * neither. Marking happens in the mushaf view.
 */
export const QURAN_BLOCK_HOST = 'quran.invalid';

/** At most this many ayahs in one block, so it stays readable on a board. */
export const QURAN_BLOCK_MAX_AYAHS = 40;

export function quranBlockLink(surah: number, from: number, to: number): string {
  return `https://${QURAN_BLOCK_HOST}/${surah}/${from}-${to}`;
}

export function parseQuranBlock(
  link: string | null | undefined,
): { surah: number; from: number; to: number } | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== QURAN_BLOCK_HOST) return null;
  const [surahPart, range = ''] = url.pathname.split('/').filter(Boolean);
  const [from, to] = range.split('-').map(Number);
  const surah = Number(surahPart);
  if (![surah, from, to].every(Number.isInteger)) return null;
  if (surah < 1 || surah > 114 || from < 1 || to < from) return null;
  if (to - from + 1 > QURAN_BLOCK_MAX_AYAHS) return null;
  return { surah, from, to };
}

interface SurahText {
  transliteration: string;
  ayahs: string[];
}

// One request per surah for the whole board, however many blocks show it.
const surahs = new Map<number, Promise<SurahText>>();
function loadSurah(n: number): Promise<SurahText> {
  let pending = surahs.get(n);
  if (!pending) {
    pending = (async () => {
      const token = await getRealtimeToken();
      const res = await fetch(`${API_URL}/quran/surahs/${n}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error('Could not load the surah');
      return (await res.json()) as SurahText;
    })();
    // A failed load is not remembered, so the next render tries again.
    pending.catch(() => surahs.delete(n));
    surahs.set(n, pending);
  }
  return pending;
}

const noop = () => {};
const NO_MARKS: readonly AnyTajweedMark[] = [];

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export function BoardQuranBlock({
  surah,
  from,
  to,
  tajweed,
}: {
  surah: number;
  from: number;
  to: number;
  /** The class's Tajweed annotations, or null outside a class. */
  tajweed: TajweedApi | null;
}) {
  const [text, setText] = useState<SurahText | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadSurah(surah)
      .then((d) => {
        if (current) setText(d);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : 'Could not load the surah');
      });
    return () => {
      current = false;
    };
  }, [surah]);

  const last = text ? Math.min(to, text.ayahs.length) : to;
  const numbers = Array.from({ length: Math.max(0, last - from + 1) }, (_, i) => from + i);

  return (
    <div
      data-quran-block
      className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-[#fffdf7] text-neutral-900 shadow-sm ring-1 ring-amber-900/10"
    >
      <div className="flex items-center justify-between border-b border-amber-900/10 px-3 py-1.5 text-xs font-semibold text-neutral-600">
        <span>
          {text?.transliteration ?? `Surah ${surah}`} {from === last ? from : `${from}–${last}`}
        </span>
        <span className="text-neutral-400">Qur’an</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error ? (
          <p className="text-center text-sm text-red-700">{error}</p>
        ) : !text ? (
          <p className="text-center text-sm text-neutral-400">Loading…</p>
        ) : numbers.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">
            This surah has {text.ayahs.length} ayahs.
          </p>
        ) : (
          <p dir="rtl" lang="ar" className="font-quran text-right text-2xl leading-[2.4]">
            {numbers.map((n) => {
              const marks = tajweed?.index.get(ayahKey(surah, n)) ?? NO_MARKS;
              return (
                <TajweedAyah
                  key={n}
                  surah={surah}
                  ayah={n}
                  text={text.ayahs[n - 1]}
                  marks={marks}
                  marksKey={marksKeyOf(marks)}
                  selection={null}
                  anchor={false}
                  interactive={false}
                  numeral={`﴿${toArabicNumerals(n)}﴾`}
                  onWord={noop}
                  onAyah={null}
                  onMark={noop}
                />
              );
            })}
          </p>
        )}
      </div>
    </div>
  );
}
