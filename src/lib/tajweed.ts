import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import {
  TAJWEED_RULES,
  type TajweedAnnotation,
  type TajweedAnnotationMode,
  type TajweedAnnotationStyle,
  type TajweedOutcome,
  type TajweedPart,
  type TajweedRef,
  type TajweedRule,
  type TajweedRuleGroupKey,
  type TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';

/**
 * Tajweed annotations on the shared mushaf.
 *
 * A mark is a list of parts — a word here, a letter two words later, one in the
 * ayah below — and nothing between two parts is implied. Addressing mirrors
 * livetich-api/src/quran/quran-words.ts exactly: a word is its position in the
 * ayah split on spaces, a letter its position among the word's grapheme
 * clusters. Keep the two in step: an offset that means one letter here and
 * another on the server would mark the wrong letter.
 */

/** An ayah's words, in reading order. */
export function splitWords(ayahText: string): string[] {
  return ayahText.split(' ').filter(Boolean);
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ar', { granularity: 'grapheme' })
    : null;

/**
 * Segmenting is pure, and the same words are asked for on every render of every
 * ayah, so each distinct word is split once and kept. A surah is a few thousand
 * words at most; the cache is cleared rather than allowed to grow forever.
 */
const graphemeCache = new Map<string, string[]>();

/**
 * A word's letters, each with the marks that belong to it.
 *
 * Intl.Segmenter everywhere it exists. The fallback — only for browsers that
 * predate it — attaches every combining mark to the character before it, which
 * agrees with the segmenter on Qur'anic text: the small waw, small yeh and
 * tatweel seats it keeps separate are not combining marks either.
 */
export function graphemes(word: string): string[] {
  const hit = graphemeCache.get(word);
  if (hit) return hit;
  let out: string[];
  if (segmenter) {
    out = Array.from(segmenter.segment(word), (s) => s.segment);
  } else {
    out = [];
    for (const ch of word) {
      if (out.length && /\p{M}/u.test(ch)) out[out.length - 1] += ch;
      else out.push(ch);
    }
  }
  if (graphemeCache.size > 20_000) graphemeCache.clear();
  graphemeCache.set(word, out);
  return out;
}

/**
 * Suggested looks per rule group — a starting point, not a standard.
 *
 * Colour-coded Tajweed mushafs do not share one scheme, so nothing here claims
 * to be "the" Madd colour. Colour lives on the group rather than the rule: a
 * teacher reads "this is a madd" from the colour and which madd from the label,
 * and fifty distinguishable colours do not exist anyway. The teacher can
 * recolour any group for their class, and the legend follows what is in effect.
 */
export const TAJWEED_GROUP_COLORS: Record<TajweedRuleGroupKey, string> = {
  nun: '#7c3aed',
  mim: '#2563eb',
  ghunnah: '#16a34a',
  qalqalah: '#ea580c',
  madd: '#dc2626',
  idgham: '#0891b2',
  lam: '#0d9488',
  ra: '#db2777',
  sifat: '#ca8a04',
  hamzah: '#4f46e5',
  waqf: '#475569',
};

/** Rules from before the taxonomy was grouped, and the teacher's own label. */
const UNGROUPED_COLOR = '#64748b';

/** The colour a rule is drawn in, honouring the teacher's own choices. */
export function ruleColor(
  rule: TajweedRule | null,
  overrides: Partial<Record<TajweedRuleGroupKey, string>> = {},
): string {
  const group = rule ? TAJWEED_RULES[rule]?.group : null;
  if (!group) return UNGROUPED_COLOR;
  return overrides[group] ?? TAJWEED_GROUP_COLORS[group];
}

/** "Ikhfa haqiqi", or the teacher's own label for a custom note. */
export function ruleLabel(
  rule: TajweedRule | null,
  customLabel: string | null,
): string {
  if (rule === 'custom') return customLabel ?? 'Note';
  return rule ? (TAJWEED_RULES[rule]?.label ?? rule) : (customLabel ?? 'Note');
}

/** The rule's name in Arabic, where it has one. */
export function ruleArabic(rule: TajweedRule | null): string | null {
  return rule ? (TAJWEED_RULES[rule]?.arabic ?? null) : null;
}

export const TAJWEED_OUTCOMES: { key: TajweedOutcome; label: string; hint: string }[] = [
  { key: 'CORRECT', label: 'Correct', hint: 'Recited well' },
  { key: 'REPEAT', label: 'Repeat', hint: 'Ask for it again' },
  { key: 'TAJWEED_ISSUE', label: 'Tajweed issue', hint: 'Pick the rule' },
  { key: 'PRONUNCIATION', label: 'Pronunciation', hint: 'A letter was mispronounced' },
  { key: 'NOTE', label: 'Note', hint: 'Anything else' },
];

/** "113:3" — the key marks are indexed by, so a render looks up one ayah's
 *  marks instead of scanning every mark for every ayah. */
export const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

/** Anything drawn on the text: a saved annotation or a live one. */
export type AnyTajweedMark = (TajweedAnnotation | TajweedTemporaryAnnotation) & {
  /** Set on live annotations only. */
  live?: boolean;
};

// ---- parts -------------------------------------------------------------

export const samePart = (a: TajweedPart, b: TajweedPart) =>
  a.surahNumber === b.surahNumber &&
  a.ayahNumber === b.ayahNumber &&
  a.wordIndex === b.wordIndex &&
  a.letterIndex === b.letterIndex;

/** Reading order, matching the server's, so a mark looks the same either way. */
export function sortParts(parts: readonly TajweedPart[]): TajweedPart[] {
  const rank = (n: number | null) => (n === null ? -1 : n);
  return [...parts].sort(
    (a, b) =>
      a.surahNumber - b.surahNumber ||
      a.ayahNumber - b.ayahNumber ||
      rank(a.wordIndex) - rank(b.wordIndex) ||
      rank(a.letterIndex) - rank(b.letterIndex),
  );
}

export const hasPart = (parts: readonly TajweedPart[], part: TajweedPart) =>
  parts.some((p) => samePart(p, part));

/** One tap: add what was picked, or drop it if it was already picked. */
export function togglePart(
  parts: readonly TajweedPart[],
  part: TajweedPart,
): TajweedPart[] {
  const at = parts.findIndex((p) => samePart(p, part));
  return at >= 0
    ? parts.filter((_, i) => i !== at)
    : sortParts([...parts, part]);
}

export const wholeWord = (
  surahNumber: number,
  ayahNumber: number,
  wordIndex: number,
): TajweedPart => ({ surahNumber, ayahNumber, wordIndex, letterIndex: null });

export const oneLetter = (
  surahNumber: number,
  ayahNumber: number,
  wordIndex: number,
  letterIndex: number,
): TajweedPart => ({ surahNumber, ayahNumber, wordIndex, letterIndex });

export const wholeAyah = (
  surahNumber: number,
  ayahNumber: number,
): TajweedPart => ({ surahNumber, ayahNumber, wordIndex: null, letterIndex: null });

/** Every ayah a mark touches — it may hold parts in more than one. */
export const ayahsOf = (mark: { parts: readonly TajweedPart[] }) => [
  ...new Map(
    mark.parts.map((p) => [ayahKey(p.surahNumber, p.ayahNumber), p]),
  ).values(),
];

/**
 * Marks by ayah. A mark that reaches into the next ayah is listed under both,
 * so each ayah renders from one lookup and a rule spanning a boundary is drawn
 * on either side of it.
 */
export function indexByAyah<T extends { parts: readonly TajweedPart[] }>(
  marks: readonly T[],
): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const mark of marks) {
    for (const { surahNumber, ayahNumber } of ayahsOf(mark)) {
      const key = ayahKey(surahNumber, ayahNumber);
      const list = index.get(key);
      if (list) list.push(mark);
      else index.set(key, [mark]);
    }
  }
  return index;
}

/** The parts of a mark that fall in one ayah. */
export const partsIn = (
  mark: { parts: readonly TajweedPart[] },
  surah: number,
  ayah: number,
) => mark.parts.filter((p) => p.surahNumber === surah && p.ayahNumber === ayah);

/**
 * What a mark covers of one word: the whole ayah, the whole word, or the exact
 * letters it holds. Null when it does not touch this word at all.
 */
export function coverage(
  mark: { parts: readonly TajweedPart[] },
  surah: number,
  ayah: number,
  word: number,
): 'ayah' | 'word' | number[] | null {
  const here = partsIn(mark, surah, ayah);
  if (here.some((p) => p.wordIndex === null)) return 'ayah';
  const onWord = here.filter((p) => p.wordIndex === word);
  if (!onWord.length) return null;
  if (onWord.some((p) => p.letterIndex === null)) return 'word';
  return onWord.map((p) => p.letterIndex!).sort((a, b) => a - b);
}

/** Where a mark sits, named ayah by ayah: "Al-Falaq 2 · word 4 + Al-Falaq 3 ·
 *  word 2". The surah's name comes from the caller, which knows the mushaf. */
export function describeParts(
  parts: readonly TajweedPart[],
  surahName: (surah: number) => string,
): string {
  const ayahs = [
    ...new Map(
      parts.map((p) => [ayahKey(p.surahNumber, p.ayahNumber), p]),
    ).entries(),
  ];
  return ayahs
    .map(([key, first]) => {
      const here = parts.filter(
        (p) => ayahKey(p.surahNumber, p.ayahNumber) === key,
      );
      const words = [
        ...new Set(here.map((p) => p.wordIndex).filter((w) => w !== null)),
      ].sort((a, b) => a! - b!);
      const where = !words.length
        ? 'the whole ayah'
        : words.length === 1
          ? `word ${words[0]! + 1}`
          : `words ${words.map((w) => w! + 1).join(' & ')}`;
      const letters = here.filter((p) => p.letterIndex !== null).length;
      const count =
        letters === 0 ? '' : letters === 1 ? ' · 1 letter' : ` · ${letters} letters`;
      return `${surahName(first.surahNumber)} ${first.ayahNumber} · ${where}${count}`;
    })
    .join('  +  ');
}

/** What the teacher currently has picked, before any rule. */
export interface TajweedSelectionState {
  parts: TajweedPart[];
}

export const EMPTY_SELECTION: TajweedSelectionState = { parts: [] };

/** A fresh client-side id. Chosen here so a create can be resent safely. */
export function newAnnotationId(): string {
  return crypto.randomUUID();
}

// ---- API --------------------------------------------------------------

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getRealtimeToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    current?: TajweedAnnotation;
  };
  const message = Array.isArray(body.message)
    ? body.message.join(', ')
    : body.message || 'Something went wrong';
  throw new TajweedApiError(res.status, message, body.current);
}

/** A failed request. 409 carries the newer version when the server has it. */
export class TajweedApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly current?: TajweedAnnotation,
  ) {
    super(message);
  }
  /** Worth retrying later: the network, or the server, not the request. */
  get retryable() {
    return this.status === 0 || this.status >= 500;
  }
}

export function listTajweed(
  courseId: string,
  q: { sessionId?: string; sectionId?: string; studentId?: string },
) {
  const params = new URLSearchParams(
    Object.entries(q).filter((e): e is [string, string] => !!e[1]),
  );
  return call<{ lesson: TajweedAnnotation[]; corrections: TajweedAnnotation[] }>(
    `/courses/${courseId}/tajweed/annotations?${params}`,
  );
}

export interface TajweedCreateInput {
  id: string;
  parts: TajweedPart[];
  mode: TajweedAnnotationMode;
  /** Keep it for next time: any class in this course that opens these ayahs
   *  shows it. Lesson material only. */
  kept?: boolean;
  sessionId?: string;
  sectionId?: string;
  studentId?: string;
  hifzEntryId?: string;
  rule?: TajweedRule;
  customLabel?: string;
  style?: TajweedAnnotationStyle;
  color?: string;
  note?: string;
  outcome?: TajweedOutcome;
}

/** Only the fields the server accepts: empty optionals are omitted rather than
 *  sent. `parts` and `kept` always go, since false and a list are meaningful. */
function createBody(input: TajweedCreateInput) {
  const { parts, kept, ...rest } = input;
  return {
    ...Object.fromEntries(
      Object.entries(rest).filter(
        ([, v]) => v !== null && v !== undefined && v !== '',
      ),
    ),
    parts,
    ...(kept === undefined ? {} : { kept }),
  };
}

export function createTajweed(courseId: string, input: TajweedCreateInput) {
  return call<TajweedAnnotation>(`/courses/${courseId}/tajweed/annotations`, {
    method: 'POST',
    body: JSON.stringify(createBody(input)),
  });
}

export function updateTajweed(
  courseId: string,
  id: string,
  // An edit can clear the optional text fields, so those take null — which the
  // create shape they come from does not.
  patch: {
    version: number;
    sessionId?: string;
    parts?: TajweedPart[];
    kept?: boolean;
    rule?: TajweedRule | null;
    style?: TajweedAnnotationStyle;
    outcome?: TajweedOutcome | null;
    note?: string | null;
    color?: string | null;
    customLabel?: string | null;
  },
) {
  return call<TajweedAnnotation>(`/courses/${courseId}/tajweed/annotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteTajweed(courseId: string, id: string, sessionId?: string) {
  const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  return call<{ deleted: true }>(`/courses/${courseId}/tajweed/annotations/${id}${q}`, {
    method: 'DELETE',
  });
}

/** One change to an annotation: who made it, when, and how it stood after. */
export interface TajweedHistoryItem {
  id: string;
  version: number;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
  changedAt: string;
  changedBy: { id: string; name: string };
  snapshot: TajweedAnnotation;
}

export function tajweedHistory(courseId: string, id: string) {
  return call<TajweedHistoryItem[]>(
    `/courses/${courseId}/tajweed/annotations/${id}/history`,
  );
}

/** Counts of what the teacher recorded for one student — never a grade. */
export interface TajweedProgressRow {
  student: { id: string; name: string };
  total: number;
  lastAt: string | null;
  byRule: Partial<Record<TajweedRule, { issues: number; correct: number }>>;
  byOutcome: Partial<Record<TajweedOutcome, number>>;
}

export function tajweedProgress(courseId: string) {
  return call<TajweedProgressRow[]>(`/courses/${courseId}/tajweed/progress`);
}

export function studentTajweedCorrections(courseId: string, studentId: string) {
  return call<{
    corrections: TajweedAnnotation[];
    byRule: Record<string, { issues: number; correct: number }>;
  }>(`/courses/${courseId}/tajweed/students/${studentId}/corrections`);
}

/** Kept only so a TajweedRef can be narrowed to what points at the text. */
export type { TajweedRef };
