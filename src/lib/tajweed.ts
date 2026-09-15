import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type {
  TajweedAnnotation,
  TajweedAnnotationMode,
  TajweedAnnotationStyle,
  TajweedOutcome,
  TajweedRef,
  TajweedRule,
  TajweedSelection,
  TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';

/**
 * Tajweed annotations on the shared mushaf.
 *
 * Addressing mirrors livetich-api/src/quran/quran-words.ts exactly: a word is
 * its position in the ayah split on spaces, a letter is its position among the
 * word's grapheme clusters. Keep the two in step — an offset that means one
 * letter here and another on the server would mark the wrong letter.
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
 * A word's letters, each with the marks that belong to it.
 *
 * Intl.Segmenter everywhere it exists. The fallback — only for browsers that
 * predate it — attaches every combining mark to the character before it, which
 * agrees with the segmenter on Qur'anic text: the small waw, small yeh and
 * tatweel seats it keeps separate are not combining marks either.
 */
export function graphemes(word: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(word), (s) => s.segment);
  const out: string[] = [];
  for (const ch of word) {
    if (out.length && /\p{M}/u.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * Suggested looks per rule — a starting point, not a standard.
 *
 * Colour-coded Tajweed mushafs do not share one scheme, so nothing here claims
 * to be "the" Madd colour. The teacher can recolour any rule for their class
 * (see useTajweedStyles), and the legend is built from whatever is in effect.
 */
export const TAJWEED_SUGGESTED_COLORS: Record<TajweedRule, string> = {
  madd: '#dc2626',
  ghunnah: '#16a34a',
  ikhfa: '#7c3aed',
  idgham: '#2563eb',
  iqlab: '#0891b2',
  izhar: '#ca8a04',
  qalqalah: '#ea580c',
  waqf: '#475569',
  custom: '#db2777',
};

export const TAJWEED_OUTCOMES: { key: TajweedOutcome; label: string; hint: string }[] = [
  { key: 'CORRECT', label: 'Correct', hint: 'Recited well' },
  { key: 'REPEAT', label: 'Repeat', hint: 'Ask for it again' },
  { key: 'TAJWEED_ISSUE', label: 'Tajweed issue', hint: 'Pick the rule' },
  { key: 'PRONUNCIATION', label: 'Pronunciation', hint: 'A letter was mispronounced' },
  { key: 'NOTE', label: 'Note', hint: 'Anything else' },
];

/** "113:3" — the key annotations are indexed by, so a render looks up one
 *  ayah's marks instead of scanning every annotation for every ayah. */
export const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

/** Anything drawn on the text: a saved annotation or a live one. */
export type AnyTajweedMark = (TajweedAnnotation | TajweedTemporaryAnnotation) & {
  /** Set on live annotations only. */
  live?: boolean;
};

export function indexByAyah<T extends TajweedRef>(marks: readonly T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const m of marks) {
    const key = ayahKey(m.surahNumber, m.ayahNumber);
    const list = index.get(key);
    if (list) list.push(m);
    else index.set(key, [m]);
  }
  return index;
}

/** Does a mark cover this word (and, for a letter mark, which letters)? */
export function coverage(
  mark: TajweedRef,
  word: number,
): 'ayah' | 'word' | { from: number; to: number } | null {
  if (mark.selection === 'AYAH') return 'ayah';
  if (mark.wordStart === null || mark.wordEnd === null) return null;
  if (word < mark.wordStart || word > mark.wordEnd) return null;
  if (mark.selection === 'WORD') return 'word';
  return { from: mark.letterStart ?? 0, to: mark.letterEnd ?? mark.letterStart ?? 0 };
}

/** What the teacher currently has selected on the text. */
export interface TajweedSelectionState {
  surahNumber: number;
  ayahNumber: number;
  selection: TajweedSelection;
  wordStart: number | null;
  wordEnd: number | null;
  letterStart: number | null;
  letterEnd: number | null;
}

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

export interface TajweedCreateInput extends TajweedRef {
  id: string;
  mode: TajweedAnnotationMode;
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

/** Only the fields the server accepts: positions that are null are omitted
 *  rather than sent, since the create DTO does not take null. */
function createBody(input: TajweedCreateInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  );
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
  patch: Partial<
    Omit<
      TajweedCreateInput,
      'id' | 'mode' | 'studentId' | 'sectionId' | 'note' | 'color' | 'customLabel'
    >
  > & {
    version: number;
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
