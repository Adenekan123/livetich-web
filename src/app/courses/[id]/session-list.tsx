import type { LiveSession } from '@/lib/types';

const STATUS_STYLES: Record<LiveSession['status'], string> = {
  SCHEDULED: 'bg-neutral-100 text-neutral-700 ring-neutral-400/30',
  LIVE: 'bg-signal-50 text-signal-700 ring-signal-600/20',
  ENDED: 'bg-neutral-100 text-neutral-500 ring-neutral-500/20',
};

const STATUS_LABEL: Record<LiveSession['status'], string> = {
  SCHEDULED: 'Open',
  LIVE: 'Live',
  ENDED: 'Ended',
};

/**
 * Read-only history of a course's live sessions. Joining and going live are
 * handled by JoinLiveCard — sessions now materialise from the program cadence,
 * so there's nothing to schedule or start here.
 */
export function SessionList({ sessions }: { sessions: LiveSession[] }) {
  return (
    <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[s.status]}`}
          >
            {s.status === 'LIVE' && (
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-signal-500" />
            )}
            {STATUS_LABEL[s.status]}
          </span>
          <span className="text-sm text-neutral-700">
            {new Date(s.scheduledAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
