'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiBookOpenText, PiPlus } from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import { formatRef, surahIndex, HIFZ_KIND_LABEL } from '@/lib/quran';
import type { HifzKind, HifzOverviewRow, Surah } from '@/lib/types';

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
}: {
  courseId: string;
  sessionId: string;
}) {
  const [rows, setRows] = useState<HifzOverviewRow[] | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);

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
    void fetch(`${API_URL}/quran/surahs`)
      .then((r) => (r.ok ? r.json() : { surahs: [] }))
      .then((d: { surahs: Surah[] }) => setSurahs(d.surahs))
      .catch(() => {});
  }, [load]);

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

                  {logFor === row.student.id ? (
                    <QuickLog
                      courseId={courseId}
                      sessionId={sessionId}
                      studentId={row.student.id}
                      surahs={surahs}
                      onDone={() => {
                        setLogFor(null);
                        void load();
                      }}
                      onCancel={() => setLogFor(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setLogFor(row.student.id)}
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

function QuickLog({
  courseId,
  sessionId,
  studentId,
  surahs,
  onDone,
  onCancel,
}: {
  courseId: string;
  sessionId: string;
  studentId: string;
  surahs: Surah[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [surah, setSurah] = useState(1);
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(1);
  const [kind, setKind] = useState<HifzKind>('NEW_HIFZ');
  const [rating, setRating] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await authFetch(`/courses/${courseId}/hifz/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          surahNumber: surah,
          ayahStart: start,
          ayahEnd: end,
          kind,
          rating: rating ? Number(rating) : undefined,
          sessionId,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(d.message || 'Failed to log');
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to log');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-signal-500 focus:outline-none';

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <select
        value={surah}
        onChange={(e) => setSurah(Number(e.target.value))}
        className={cn(field, 'w-full')}
      >
        {surahs.map((s) => (
          <option key={s.number} value={s.number} className="bg-neutral-900">
            {s.number}. {s.transliteration}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-neutral-400">Ayah</label>
        <input
          type="number"
          min={1}
          value={start}
          onChange={(e) => setStart(Number(e.target.value))}
          className={cn(field, 'w-16')}
        />
        <span className="text-neutral-500">–</span>
        <input
          type="number"
          min={1}
          value={end}
          onChange={(e) => setEnd(Number(e.target.value))}
          className={cn(field, 'w-16')}
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as HifzKind)}
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
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          placeholder="★1-5"
          className={cn(field, 'w-16')}
        />
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded-md bg-signal-500 px-2 py-1 text-xs font-semibold text-white hover:bg-signal-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
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
