'use client';

import { useEffect, useState } from 'react';
import {
  PiCalendarBlank,
  PiCheckCircle,
  PiClipboardText,
  PiEye,
  PiFileText,
  PiPaperclip,
  PiUsersThree,
} from 'react-icons/pi';
import { avatarColor, btn, cn, initials, inputClass } from '@/lib/ui';
import type {
  AssignmentTracking,
  StudentGroup,
  StudentRef,
  TrackingSubmission,
} from '@/lib/types';
import { AddAssignmentForm } from './add-assignment-form';
import { GradeForm } from './grade-form';
import { GroupsManager } from './groups/groups-manager';

type SessionOption = { id: string; label: string; scheduledAt: string };
type View = 'assignments' | 'groups';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|#|$)/i;
const AUDIO_RE = /\.(mp3|wav|ogg|oga|webm|m4a|aac|flac)(\?|#|$)/i;

function subIsImage(s: TrackingSubmission): boolean {
  return (
    (s.fileMimeType?.startsWith('image/') ?? false) ||
    (s.fileUrl ? IMAGE_RE.test(s.fileUrl) : false)
  );
}
function subIsAudio(s: TrackingSubmission): boolean {
  return (
    (s.fileMimeType?.startsWith('audio/') ?? false) ||
    (s.fileUrl ? AUDIO_RE.test(s.fileUrl) : false)
  );
}
function subKind(s: TrackingSubmission): string {
  if (s.fileUrl) {
    if (subIsAudio(s)) return 'Audio';
    if (subIsImage(s)) return 'Image';
    return 'File';
  }
  return s.content ? 'Text' : '—';
}

/**
 * Instructor/admin "Assignment Lab": a sidebar + main-panel dashboard. The
 * sidebar switches features (Assignments, Groups), filters coursework by
 * session and lists it; the main panel views the selected assignment — its
 * submissions (each openable in a viewer), inline grading and who is missing.
 */
export function AssignmentLab({
  courseId,
  tracking,
  groups,
  roster,
  sessions,
  nextSessionId = '',
}: {
  courseId: string;
  tracking: AssignmentTracking[];
  groups: StudentGroup[];
  roster: StudentRef[];
  sessions: SessionOption[];
  /** Soonest upcoming session — new coursework defaults to this "next class". */
  nextSessionId?: string;
}) {
  const [view, setView] = useState<View>('assignments');
  const [selectedId, setSelectedId] = useState<string | null>(
    tracking[0]?.id ?? null,
  );
  const [sessionFilter, setSessionFilter] = useState<string>('all');

  const groupOptions = groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
  }));

  // Distinct sessions that assignments are actually tied to (for the filter).
  const sessionFilters = new Map<string, string>();
  let hasUntied = false;
  for (const a of tracking) {
    if (a.session) {
      sessionFilters.set(a.session.id, `Class · ${fmtDate(a.session.scheduledAt)}`);
    } else {
      hasUntied = true;
    }
  }

  const visible = tracking.filter((a) => {
    if (sessionFilter === 'all') return true;
    if (sessionFilter === 'none') return !a.session;
    return a.session?.id === sessionFilter;
  });

  // Keep selection valid even after filtering / create / delete reshapes the list.
  const selected =
    visible.find((a) => a.id === selectedId) ?? visible[0] ?? null;

  return (
    <section className="mt-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
        Assignment lab
      </h1>

      <div className="mt-4 flex flex-col gap-5 lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-72 lg:shrink-0">
          <nav className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100/70 p-1">
            <NavPill
              active={view === 'assignments'}
              onClick={() => setView('assignments')}
              icon={<PiClipboardText className="h-4 w-4" />}
              label="Assignments"
              count={tracking.length}
            />
            <NavPill
              active={view === 'groups'}
              onClick={() => setView('groups')}
              icon={<PiUsersThree className="h-4 w-4" />}
              label="Groups"
              count={groups.length}
            />
          </nav>

          {view === 'assignments' && (
            <div className="mt-3">
              <AddAssignmentForm
                courseId={courseId}
                groups={groupOptions}
                sessions={sessions}
                nextSessionId={nextSessionId}
              />

              {sessionFilters.size > 0 && (
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  aria-label="Filter by session"
                  className={cn(inputClass, 'mt-3 py-2 text-sm')}
                >
                  <option value="all">All sessions</option>
                  {[...sessionFilters].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                  {hasUntied && <option value="none">No session</option>}
                </select>
              )}

              {tracking.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-5 text-sm text-neutral-500">
                  No assignments yet.
                </p>
              ) : visible.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-5 text-sm text-neutral-500">
                  No assignments for this session.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1">
                  {visible.map((a) => (
                    <li key={a.id}>
                      <SidebarItem
                        a={a}
                        active={selected?.id === a.id}
                        onClick={() => setSelectedId(a.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* Main panel */}
        <div className="min-w-0 flex-1">
          {view === 'groups' ? (
            <GroupsManager courseId={courseId} groups={groups} roster={roster} />
          ) : selected ? (
            <AssignmentDetail courseId={courseId} a={selected} />
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-20 text-center">
              <div>
                <PiClipboardText className="mx-auto h-8 w-8 text-neutral-300" />
                <p className="mt-3 text-sm font-medium text-neutral-700">
                  No assignments yet
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Create one — target the whole class or a group, and optionally
                  tie it to a session.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NavPill({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
        active
          ? 'bg-white text-neutral-950 shadow-sm'
          : 'text-neutral-500 hover:text-neutral-800',
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
          active ? 'bg-signal-700 text-white' : 'bg-neutral-200 text-neutral-500',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SidebarItem({
  a,
  active,
  onClick,
}: {
  a: AssignmentTracking;
  active: boolean;
  onClick: () => void;
}) {
  const done = a.audienceCount > 0 && a.submittedCount === a.audienceCount;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-3.5 py-3 text-left transition',
        active
          ? 'border-neutral-950 bg-white shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-300',
      )}
    >
      <p className="truncate text-sm font-semibold text-neutral-950">{a.title}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="truncate rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
          {a.group ? a.group.name : 'Whole class'}
        </span>
        {a.session && (
          <PiCalendarBlank className="h-3 w-3 shrink-0 text-signal-500" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={cn('h-full rounded-full', done ? 'bg-signal-600' : 'bg-accent-500')}
            style={{
              width: `${
                a.audienceCount > 0
                  ? Math.round((a.submittedCount / a.audienceCount) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-medium text-neutral-400">
          {a.submittedCount}/{a.audienceCount}
        </span>
      </div>
    </button>
  );
}

function AssignmentDetail({
  courseId,
  a,
}: {
  courseId: string;
  a: AssignmentTracking;
}) {
  const [viewing, setViewing] = useState<TrackingSubmission | null>(null);
  const pct =
    a.audienceCount > 0
      ? Math.round((a.submittedCount / a.audienceCount) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-neutral-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
            {a.title}
          </h2>
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
            {a.group ? a.group.name : 'Whole class'}
          </span>
          {a.session && (
            <span className="inline-flex items-center gap-1 rounded-full bg-signal-50 px-2 py-0.5 text-[11px] font-semibold text-signal-700">
              <PiCalendarBlank className="h-3 w-3" />
              Class · {fmtDate(a.session.scheduledAt)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {a.dueAt ? `Due ${fmtDateTime(a.dueAt)}` : 'No due date'}
          {a.maxPoints != null && (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              {a.maxPoints} pts
            </>
          )}
        </p>

        {a.instructions && (
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            {a.instructions}
          </p>
        )}

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-signal-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-semibold text-neutral-900">
            {a.submittedCount}/{a.audienceCount} submitted
          </span>
          <span className="shrink-0 text-sm text-neutral-400">
            {a.gradedCount} graded
          </span>
        </div>
      </div>

      {/* Submissions */}
      <div className="p-5 sm:p-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Submissions ({a.submitted.length})
        </h3>
        {a.submitted.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-8 text-center text-sm text-neutral-500">
            No submissions yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {a.submitted.map((s) => (
              <SubmittedRow
                key={s.submissionId}
                maxPoints={a.maxPoints}
                s={s}
                onView={() => setViewing(s)}
              />
            ))}
          </div>
        )}

        {/* Missing */}
        {a.missing.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Not submitted ({a.missing.length})
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.missing.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-500"
                  title={m.email}
                >
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded-full text-[8px] font-semibold text-white',
                      avatarColor(m.id),
                    )}
                    aria-hidden
                  >
                    {initials(m.name)}
                  </span>
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewing && (
        <SubmissionViewer
          courseId={courseId}
          assignmentId={a.id}
          assignmentTitle={a.title}
          maxPoints={a.maxPoints}
          s={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/** Compact row — identity, grade badge, a hint at the payload, and View. */
function SubmittedRow({
  maxPoints,
  s,
  onView,
}: {
  maxPoints: number | null;
  s: TrackingSubmission;
  onView: () => void;
}) {
  const kind = subKind(s);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
          avatarColor(s.student.id),
        )}
        aria-hidden
      >
        {initials(s.student.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {s.student.name}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-neutral-400">
          {s.fileUrl ? (
            <PiPaperclip className="h-3 w-3" />
          ) : (
            <PiFileText className="h-3 w-3" />
          )}
          {kind} · {fmtDateTime(s.submittedAt)}
        </p>
      </div>
      {s.grade != null ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
          <PiCheckCircle className="h-3.5 w-3.5" />
          {s.grade}
          {maxPoints != null ? `/${maxPoints}` : ''}
        </span>
      ) : (
        <span className="shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-400">
          Ungraded
        </span>
      )}
      <button
        onClick={onView}
        className={cn(btn('secondary', 'sm'), 'shrink-0')}
      >
        <PiEye className="h-4 w-4" /> View
      </button>
    </div>
  );
}

/** Modal viewer for one submission: full text, image/file preview, and grading. */
function SubmissionViewer({
  courseId,
  assignmentId,
  assignmentTitle,
  maxPoints,
  s,
  onClose,
}: {
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  maxPoints: number | null;
  s: TrackingSubmission;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const audio = subIsAudio(s);
  const image = !audio && subIsImage(s);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Submission from ${s.student.name}`}
        className="my-4 w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl sm:my-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-100 p-5">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white',
              avatarColor(s.student.id),
            )}
            aria-hidden
          >
            {initials(s.student.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-950">
              {s.student.name}
            </p>
            <p className="truncate text-xs text-neutral-400">
              {assignmentTitle} · submitted {fmtDateTime(s.submittedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {!s.content && !s.fileUrl && (
            <p className="text-sm text-neutral-500">This submission is empty.</p>
          )}

          {s.content && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Text
              </p>
              <p className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
                {s.content}
              </p>
            </div>
          )}

          {s.fileUrl && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Attachment
              </p>
              {audio ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={s.fileUrl} className="w-full" />
                  <a
                    href={s.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-signal-700 hover:text-signal-600"
                  >
                    Open in new tab ↗
                  </a>
                </>
              ) : image ? (
                <a href={s.fileUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.fileUrl}
                    alt={`Submission from ${s.student.name}`}
                    className="max-h-[45vh] w-auto rounded-xl border border-neutral-200 object-contain"
                  />
                </a>
              ) : (
                <a
                  href={s.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-signal-700 text-white">
                    <PiPaperclip className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-900">
                      Open attachment ↗
                    </span>
                    <span className="block truncate text-xs text-neutral-400">
                      {s.fileUrl}
                    </span>
                  </span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Grade */}
        <div className="border-t border-neutral-100 bg-neutral-50/50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Grade{s.grade != null ? ` · currently ${s.grade}${maxPoints != null ? `/${maxPoints}` : ''}` : ''}
          </p>
          <GradeForm
            submissionId={s.submissionId}
            courseId={courseId}
            assignmentId={assignmentId}
            grade={s.grade}
            feedback={s.feedback}
            maxPoints={maxPoints}
          />
        </div>
      </div>
    </div>
  );
}
