import type { HifzKind, Surah } from './types';

/** Quick lookup of surah metadata by number, built from the fetched catalog. */
export function surahIndex(surahs: Surah[]): Map<number, Surah> {
  return new Map(surahs.map((s) => [s.number, s]));
}

/** "Al-Baqarah 1–5" or "Al-Fatihah 1–7 (whole surah)". */
export function formatRef(
  index: Map<number, Surah>,
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
): string {
  const s = index.get(surahNumber);
  const name = s ? s.transliteration : `Surah ${surahNumber}`;
  const range = ayahStart === ayahEnd ? `${ayahStart}` : `${ayahStart}–${ayahEnd}`;
  const whole = s && ayahStart === 1 && ayahEnd === s.ayahCount;
  return `${name} ${range}${whole ? ' (whole surah)' : ''}`;
}

export const HIFZ_KIND_LABEL: Record<HifzKind, string> = {
  NEW_HIFZ: 'New',
  REVISION: 'Revision',
};
