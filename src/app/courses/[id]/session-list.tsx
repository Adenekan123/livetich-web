import Link from 'next/link';
import { endSession, startSession } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { btn } from '@/lib/ui';
import type { LiveSession } from '@/lib/types';

const STATUS_STYLES: Record<LiveSession['status'], string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  LIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ENDED: 'bg-slate-100 text-slate-500 ring-slate-500/20',
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
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-6 text-sm text-slate-500">
        No sessions scheduled yet.
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[s.status]}`}
            >
              {s.status === 'LIVE' && (
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {s.status}
            </span>
            <span className="text-sm text-slate-700">
              {new Date(s.scheduledAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {s.status === 'LIVE' && canJoin && (
              <Link
                href={`/sessions/${s.id}`}
                className={btn('primary', 'sm', 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500 focus-visible:ring-emerald-500')}
              >
                Join class →
              </Link>
            )}
            {isOwner && s.status === 'SCHEDULED' && (
              <form action={startSession.bind(null, s.id, courseId)}>
                <SubmitButton size="sm" pendingLabel="Starting…">
                  Go live
                </SubmitButton>
              </form>
            )}
            {isOwner && s.status === 'LIVE' && (
              <form action={endSession.bind(null, s.id, courseId)}>
                <SubmitButton variant="secondary" size="sm" pendingLabel="Ending…">
                  End session
                </SubmitButton>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
