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

const SURAH_FALLBACKS: Record<number, SurahText> = {
  1: {
    transliteration: 'Al-Fatihah',
    ayahs: [
      'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
      'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
      'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
      'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
      'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
      'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
    ],
  },
  2: {
    transliteration: 'Al-Baqarah',
    ayahs: [
      'الٓمٓ',
      'ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ',
      'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَـٰهُمْ يُنفِقُونَ',
      'وَٱلَّذِينَ يُؤْمِنُونَ بِمَآ أُنزِلَ إِلَيْكَ وَمَآ أُنزِلَ مِن قَبْلِكَ وَبِٱلْـَٔاخِرَةِ هُمْ يُوقِنُونَ',
      'أُو۟لَـٰٓئِكَ عَلَىٰ هُدًۭى مِّن رَّبِّهِمْ ۖ وَأُو۟لَـٰٓئِكَ هُمُ ٱلْمُفْلِحُونَ',
    ],
  },
  18: {
    transliteration: 'Al-Kahf',
    ayahs: [
      'ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ وَلَمْ يَجْعَل لَّهُۥ عِوَجَاۜ',
      'قَيِّمًۭا لِّيُنذِرَ بَأْسًۭا شَدِيدًۭا مِّن لَّدُنْهُ وَيُبَشِّرَ ٱلْمُؤْمِنِينَ ٱلَّذِينَ يَعْمَلُونَ ٱلصَّـٰلِحَـٰتِ أَنَّ لَهُمْ أَجْرًا حَسَنًۭا',
    ],
  },
  36: {
    transliteration: 'Ya-Sin',
    ayahs: [
      'يسٓ',
      'وَٱلْقُرْءَانِ ٱلْحَكِيمِ',
      'إِنَّكَ لَمِنَ ٱلْمُرْسَلِينَ',
      'عَلَىٰ صِرَٰطٍۢ مُّسْتَقِيمٍۢ',
    ],
  },
  67: {
    transliteration: 'Al-Mulk',
    ayahs: [
      'تَبَـٰرَكَ ٱلَّذِى بِيَدِهِ ٱلْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَىْءٍۢ قَدِيرٌ',
      'ٱلَّذِى خَلَقَ ٱلْمَوْتَ وَٱلْحَيَوٰةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًۭا ۚ وَهُوَ ٱلْعَزِيزُ ٱلْغَفُورُ',
    ],
  },
  112: {
    transliteration: 'Al-Ikhlas',
    ayahs: [
      'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      'ٱللَّهُ ٱلصَّمَدُ',
      'لَمْ يَلِدْ وَلَمْ يُولَدْ',
      'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
    ],
  },
  113: {
    transliteration: 'Al-Falaq',
    ayahs: [
      'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
      'مِن شَرِّ مَا خَلَقَ',
      'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
      'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ',
      'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    ],
  },
  114: {
    transliteration: 'An-Nas',
    ayahs: [
      'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
      'مَلِكِ ٱلنَّاسِ',
      'إِلَـٰهِ ٱلنَّاسِ',
      'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
      'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
      'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
    ],
  },
};

// One request per surah for the whole board, however many blocks show it.
const surahs = new Map<number, Promise<SurahText>>();
function loadSurah(n: number): Promise<SurahText> {
  let pending = surahs.get(n);
  if (!pending) {
    pending = (async () => {
      try {
        const token = await getRealtimeToken();
        const res = await fetch(`${API_URL}/quran/surahs/${n}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (res.ok) {
          return (await res.json()) as SurahText;
        }
      } catch {
        // Network or API failure -> proceed to fallback
      }
      if (SURAH_FALLBACKS[n]) {
        return SURAH_FALLBACKS[n];
      }
      return {
        transliteration: `Surah ${n}`,
        ayahs: ['بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'],
      };
    })();
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
                  picked={[]}
                  pointed={[]}
                  anchor={false}
                  interactive={false}
                  numeral={`﴿${toArabicNumerals(n)}﴾`}
                  onPart={noop}
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
