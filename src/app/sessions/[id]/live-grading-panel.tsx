'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PiCheckCircle,
  PiClipboardText,
  PiCopy,
  PiDownloadSimple,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import type { AssignmentTracking, TrackingSubmission } from '@/lib/types';

/** Editor language id → file extension, for the "download to run locally" file. */
const LANG_EXT: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  jsx: 'tsx',
  python: 'py',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'md',
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

const AUDIO_RE = /\.(mp3|wav|ogg|oga|webm|m4a|aac|flac)(\?|#|$)/i;
function isAudio(s: TrackingSubmission): boolean {
  return (
    (s.fileMimeType?.startsWith('audio/') ?? false) ||
    (s.fileUrl ? AUDIO_RE.test(s.fileUrl) : false)
  );
}

/**
 * Instructor-only live panel: grade this session's assignments (or all of
 * them) without leaving the class — plays recitation audio inline.
 */
export function LiveGradingPanel({
  courseId,
  sessionId,
  refreshSignal = 0,
}: {
  courseId: string;
  sessionId: string;
  /** Bumped by the class room on every `submission:new` push, so the panel
   *  reloads the roster the moment a student submits. */
  refreshSignal?: number;
}) {
  const [tracking, setTracking] = useState<AssignmentTracking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'session' | 'all'>('session');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/courses/${courseId}/assignments/tracking`);
      if (!res.ok) throw new Error('Failed to load assignments');
      setTracking((await res.json()) as AssignmentTracking[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A student just submitted (real-time) — pull the fresh roster + code.
  useEffect(() => {
    if (refreshSignal > 0) void load();
  }, [refreshSignal, load]);

  const visible = (tracking ?? []).filter((a) =>
    scope === 'session' ? a.sessionId === sessionId : true,
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 text-sm text-neutral-200">
      <div className="mb-2 flex gap-1 rounded-lg bg-white/5 p-1">
        {(['session', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-semibold transition',
              scope === s
                ? 'bg-white/15 text-white'
                : 'text-neutral-400 hover:text-white',
            )}
          >
            {s === 'session' ? 'This session' : 'All'}
          </button>
        ))}
      </div>

      {error && <p className="px-1 text-xs text-red-400">{error}</p>}
      {!tracking && !error && (
        <p className="px-1 text-xs text-neutral-500">Loading…</p>
      )}
      {tracking && visible.length === 0 && (
        <p className="px-1 text-xs text-neutral-500">
          {scope === 'session'
            ? 'No assignments tied to this session.'
            : 'No assignments yet.'}
        </p>
      )}

      <ul className="space-y-1.5">
        {visible.map((a) => {
          const isOpen = openId === a.id;
          return (
            <li
              key={a.id}
              className="rounded-lg border border-white/10 bg-white/5"
            >
              <button
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="w-full px-3 py-2.5 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate font-medium text-white">
                    <PiClipboardText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    {a.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {a.submittedCount}/{a.audienceCount}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {a.group ? a.group.name : 'Whole class'} · {a.gradedCount}{' '}
                  graded
                </p>
              </button>

              {isOpen && (
                <div className="border-t border-white/10 px-3 py-2.5">
                  {a.submitted.length === 0 ? (
                    <p className="text-xs text-neutral-500">No submissions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {a.submitted.map((s) => (
                        <GradeRow
                          key={s.submissionId}
                          maxPoints={a.maxPoints}
                          s={s}
                          onGraded={load}
                        />
                      ))}
                    </div>
                  )}
                  {a.missing.length > 0 && (
                    <p className="mt-2 text-[11px] text-neutral-500">
                      Missing: {a.missing.map((m) => m.name).join(', ')}
                    </p>
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
 * A code submission rendered for review: monospace, scrollable, with the
 * language, a copy button, and a download that hands the instructor a
 * properly-named file to open and run in their own editor.
 */
function CodeSubmission({
  content,
  language,
  student,
}: {
  content: string;
  language: string;
  student: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the download button is the fallback.
    }
  };

  const download = () => {
    const ext = LANG_EXT[language] ?? 'txt';
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(student) || 'submission'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-1.5 overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-1">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
          {language}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <PiCopy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={download}
            title="Download to open in your editor"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <PiDownloadSimple className="h-3 w-3" />
            File
          </button>
        </div>
      </div>
      <pre className="max-h-64 overflow-auto px-2.5 py-2 text-[11px] leading-relaxed text-neutral-200">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function GradeRow({
  maxPoints,
  s,
  onGraded,
}: {
  maxPoints: number | null;
  s: TrackingSubmission;
  onGraded: () => void | Promise<void>;
}) {
  const [grade, setGrade] = useState(s.grade != null ? String(s.grade) : '');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    if (grade === '') return;
    setBusy(true);
    setOk(false);
    try {
      const res = await authFetch(`/submissions/${s.submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: Number(grade) }),
      });
      if (res.ok) {
        setOk(true);
        await onGraded();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-white">
          {s.student.name}
        </span>
        {s.grade != null && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-signal-300">
            <PiCheckCircle className="h-3 w-3" />
            {s.grade}
            {maxPoints != null ? `/${maxPoints}` : ''}
          </span>
        )}
      </div>

      {s.content && s.language ? (
        <CodeSubmission
          content={s.content}
          language={s.language}
          student={s.student.name}
        />
      ) : s.content ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-300">
          {s.content}
        </p>
      ) : null}
      {s.fileUrl && isAudio(s) && (
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        <audio controls src={s.fileUrl} className="mt-1.5 w-full" />
      )}
      {s.fileUrl && !isAudio(s) && (
        <a
          href={s.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs font-medium text-signal-300 hover:text-signal-200"
        >
          Open attachment ↗
        </a>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={maxPoints ?? undefined}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder={`Grade${maxPoints ? ` /${maxPoints}` : ''}`}
          className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-signal-500 focus:outline-none"
        />
        <button
          onClick={save}
          disabled={busy || grade === ''}
          className="rounded-md bg-signal-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-signal-400 disabled:opacity-50"
        >
          {busy ? '…' : s.grade != null ? 'Update' : 'Grade'}
        </button>
        {ok && <span className="text-xs text-signal-300">✓</span>}
      </div>
    </div>
  );
}
