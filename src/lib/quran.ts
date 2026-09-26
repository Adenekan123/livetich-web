import type { HifzEntry, HifzKind, HifzTarget, Surah } from './types';

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

/** Short form for a card: "Yunus 1–109", never the "(whole surah)" tail. */
export function shortRef(
  index: Map<number, Surah>,
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
): string {
  const s = index.get(surahNumber);
  const name = s ? s.transliteration : `Surah ${surahNumber}`;
  return `${name} ${ayahStart === ayahEnd ? ayahStart : `${ayahStart}–${ayahEnd}`}`;
}

/**
 * How much of a target the student has actually memorised.
 *
 * The two records are kept separately — a target is what was set, an entry is
 * what was heard — and nothing in the database joins them. So the overlap is
 * computed: new-memorization entries in the target's surah, clipped to the
 * target's range, counted as distinct ayahs. Reciting the same ayah twice is
 * not twice the progress, which is why this counts ayahs rather than summing
 * ranges.
 *
 * Revision is deliberately excluded. Revising is not memorising something new,
 * and counting it would let a student "complete" a target by re-reciting what
 * they already knew.
 */
export function ayahsDoneInTarget(
  entries: HifzEntry[],
  target: Pick<HifzTarget, 'surahNumber' | 'ayahStart' | 'ayahEnd'>,
): number {
  return coveredSet(entries, target).size;
}

function coveredSet(
  entries: HifzEntry[],
  target: Pick<HifzTarget, 'surahNumber' | 'ayahStart' | 'ayahEnd'>,
): Set<number> {
  const done = new Set<number>();
  for (const e of entries) {
    if (e.kind !== 'NEW_HIFZ' || e.surahNumber !== target.surahNumber) continue;
    const from = Math.max(e.ayahStart, target.ayahStart);
    const to = Math.min(e.ayahEnd, target.ayahEnd);
    for (let a = from; a <= to; a++) done.add(a);
  }
  return done;
}

/**
 * Where the next sitting picks up: the first ayah of the target that has not
 * been heard yet.
 *
 * This is what spares the teacher the re-entry that made the old screen slow —
 * the form opens on the student's actual place in the surah instead of on
 * Al-Fatihah, which is where every form used to start regardless of what the
 * student was working on. Falls back to the start of the target when the whole
 * thing is done, so the range stays inside the target either way.
 */
export function nextAyahInTarget(
  entries: HifzEntry[],
  target: Pick<HifzTarget, 'surahNumber' | 'ayahStart' | 'ayahEnd'>,
): number {
  const done = coveredSet(entries, target);
  for (let a = target.ayahStart; a <= target.ayahEnd; a++) {
    if (!done.has(a)) return a;
  }
  return target.ayahStart;
}

/** Ayahs a target covers, for "12 of 109". */
export function targetLength(
  target: Pick<HifzTarget, 'ayahStart' | 'ayahEnd'>,
): number {
  return Math.max(0, target.ayahEnd - target.ayahStart + 1);
}
