'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { PiBookOpenText, PiPlus } from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import { formatRef, surahIndex, HIFZ_KIND_LABEL } from '@/lib/quran';
import type { HifzKind, HifzOverviewRow, Surah } from '@/lib/types';

/** A recitation being built up live from the shared mushaf: the range grows as
 *  the instructor turns the page, then it's saved (manually or on session end). */
export interface HifzDraft {
  studentId: string;
  studentName: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  kind: HifzKind;
  rating: string; // '' or '1'..'5'
}

async function authFetch(path: string, init?: RequestInit) {
  const token = await getRealtimeToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
}

/** Persist a draft as a Hifz entry attributed to this session. Shared by the
 *  panel's Save button and the classroom's auto-save when the instructor ends. */
export async function submitHifzDraft(
  courseId: string,
  sessionId: string,
  draft: HifzDraft,
): Promise<void> {
  const res = await authFetch(`/courses/${courseId}/hifz/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: draft.studentId,
      surahNumber: draft.surah,
      ayahStart: draft.ayahStart,
      ayahEnd: draft.ayahEnd,
      kind: draft.kind,
      rating: draft.rating ? Number(draft.rating) : undefined,
      sessionId,
    }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(d.message || 'Failed to log');
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Instructor-only live panel: where every student stopped their memorization,
 * with recitations logged this session flagged. Also logs a new recitation
 * (attributed to this session) without leaving the class.
 */
export function LiveHifzPanel({
  courseId,
  sessionId,
  quranPos,
  draft,
  setDraft,
}: {
  courseId: string;
  sessionId: string;
  /** The shared mushaf position — the draft's range grows to follow it. */
  quranPos: { surah: number; ayah: number };
  /** The in-progress recitation, lifted up so it survives panel switches and
   *  the classroom can auto-save it on End class. */
  draft: HifzDraft | null;
  setDraft: Dispatch<SetStateAction<HifzDraft | null>>;
}) {
  const [rows, setRows] = useState<HifzOverviewRow[] | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const index = useMemo(() => surahIndex(surahs), [surahs]);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/courses/${courseId}/hifz`);
      if (!res.ok) throw new Error('Failed to load hifz');
      setRows((await res.json()) as HifzOverviewRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [courseId]);

  useEffect(() => {
    void load();
    void authFetch('/quran/surahs')
      .then((r) => (r.ok ? r.json() : { surahs: [] }))
      .then((d: { surahs: Surah[] }) => setSurahs(d.surahs))
      .catch(() => {});
  }, [load]);

  const startDraft = (row: HifzOverviewRow) => {
    setSaveErr(null);
    setDraft({
      studentId: row.student.id,
      studentName: row.student.name,
      surah: quranPos.surah,
      ayahStart: quranPos.ayah,
      ayahEnd: quranPos.ayah,
      kind: 'NEW_HIFZ',
      rating: '',
    });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setSaveErr(null);
    try {
      await submitHifzDraft(courseId, sessionId, draft);
      setDraft(null);
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to log');
    } finally {
      setBusy(false);
    }
  };

  const latestEntry = (row: HifzOverviewRow) => row.entries[0] ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-3 text-sm text-neutral-200">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-neutral-400">
        <PiBookOpenText className="h-4 w-4" /> Where each student stopped
      </p>

      {error && <p className="px-1 text-xs text-red-400">{error}</p>}
      {!rows && !error && (
        <p className="px-1 text-xs text-neutral-500">Loading…</p>
      )}
      {rows && rows.length === 0 && (
        <p className="px-1 text-xs text-neutral-500">No students enrolled.</p>
      )}

      <ul className="space-y-1.5">
        {rows?.map((row) => {
          const last = latestEntry(row);
          const isOpen = openId === row.student.id;
          const thisSession = last?.sessionId === sessionId;
          return (
            <li
              key={row.student.id}
              className="rounded-lg border border-white/10 bg-white/5"
            >
              <button
                onClick={() => setOpenId(isOpen ? null : row.student.id)}
                className="w-full px-3 py-2.5 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-white">
                    {row.student.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {row.progress.ayahsMemorized} ayahs
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-400">
                  {last
                    ? `Last: ${formatRef(index, last.surahNumber, last.ayahStart, last.ayahEnd)}`
                    : 'No recitations yet'}
                  {last && (
                    <>
                      {' · '}
                      {HIFZ_KIND_LABEL[last.kind]}
                      {last.rating ? ` · ★${last.rating}` : ''}
                    </>
                  )}
                </p>
                {thisSession && (
                  <span className="mt-1 inline-block rounded-full bg-signal-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-signal-300">
                    Recited this session
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-white/10 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Recent recitations
                  </p>
                  {row.entries.length === 0 ? (
                    <p className="mt-1 text-xs text-neutral-500">None yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {row.entries.slice(0, 6).map((e) => (
                        <li key={e.id} className="text-xs text-neutral-300">
                          <span className="text-neutral-200">
                            {formatRef(index, e.surahNumber, e.ayahStart, e.ayahEnd)}
                          </span>
                          <span className="text-neutral-500">
                            {' · '}
                            {HIFZ_KIND_LABEL[e.kind]}
                            {e.rating ? ` · ★${e.rating}` : ''}
                            {' · '}
                            {timeAgo(e.recordedAt)}
                            {e.sessionId === sessionId ? ' · today' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {draft?.studentId === row.student.id ? (
                    <DraftForm
                      draft={draft}
                      index={index}
                      busy={busy}
                      err={saveErr}
                      onKind={(k) => setDraft((d) => (d ? { ...d, kind: k } : d))}
                      onRating={(r) =>
                        setDraft((d) => (d ? { ...d, rating: r } : d))
                      }
                      onSave={save}
                      onCancel={() => {
                        setDraft(null);
                        setSaveErr(null);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => startDraft(row)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-signal-300 hover:text-signal-200"
                    >
                      <PiPlus className="h-3 w-3" /> Log recitation
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The live recitation form. The surah + ayah range aren't typed — they mirror
 * the shared mushaf and grow as the instructor turns the page. Only the kind
 * and rating are entered; Save logs the whole session's span at once.
 */
function DraftForm({
  draft,
  index,
  busy,
  err,
  onKind,
  onRating,
  onSave,
  onCancel,
}: {
  draft: HifzDraft;
  index: Map<number, Surah>;
  busy: boolean;
  err: string | null;
  onKind: (k: HifzKind) => void;
  onRating: (r: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const field =
    'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-signal-500 focus:outline-none';

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-signal-500/30 bg-signal-500/5 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-signal-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-400" />
        Recording — follows the mushaf
      </p>
      <p className="text-sm font-semibold text-white">
        {formatRef(index, draft.surah, draft.ayahStart, draft.ayahEnd)}
      </p>
      <p className="text-[11px] leading-snug text-neutral-400">
        Turn the page in the Qur’an view to extend the range. Saves the whole
        span read this session.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={draft.kind}
          onChange={(e) => onKind(e.target.value as HifzKind)}
          className={cn(field, 'flex-1')}
        >
          <option value="NEW_HIFZ" className="bg-neutral-900">
            New hifz
          </option>
          <option value="REVISION" className="bg-neutral-900">
            Revision
          </option>
        </select>
        <input
          type="number"
          min={1}
          max={5}
          value={draft.rating}
          onChange={(e) => onRating(e.target.value)}
          placeholder="★1-5"
          className={cn(field, 'w-16')}
        />
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-1 rounded-md bg-signal-500 px-2 py-1 text-xs font-semibold text-white hover:bg-signal-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save recitation'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
