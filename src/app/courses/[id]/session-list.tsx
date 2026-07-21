import Link from 'next/link';
import { endSession, startSession } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import type { LiveSession } from '@/lib/types';

const STATUS_STYLES: Record<LiveSession['status'], string> = {
  SCHEDULED: 'bg-amber-100 text-amber-800',
  LIVE: 'bg-emerald-100 text-emerald-800',
  ENDED: 'bg-slate-100 text-slate-500',
};

export function SessionList({
  sessions,
  courseId,
  isOwner,
  canJoin,
}: {
  sessions: LiveSession[];
  courseId: string;
  isOwner: boolean;
  canJoin: boolean;
}) {
  if (sessions.length === 0) {
    return <p className="mt-2 text-sm text-slate-600">No sessions scheduled.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm"
        >
          <div className="flex items-center gap-3">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
            >
              {s.status}
            </span>
            <span className="text-slate-700">
              {new Date(s.scheduledAt).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {s.status === 'LIVE' && canJoin && (
              <Link
                href={`/sessions/${s.id}`}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Join class
              </Link>
            )}
            {isOwner && s.status === 'SCHEDULED' && (
              <form action={startSession.bind(null, s.id, courseId)}>
                <SubmitButton className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                  Go live
                </SubmitButton>
              </form>
            )}
            {isOwner && s.status === 'LIVE' && (
              <form action={endSession.bind(null, s.id, courseId)}>
                <SubmitButton className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  End
                </SubmitButton>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
