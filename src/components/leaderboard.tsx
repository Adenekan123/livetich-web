import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { LeaderboardRow } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

/**
 * A course leaderboard rendered OUTSIDE the live room (student dashboard,
 * program detail, instructor view). Points are earned in live class (quizzes +
 * buzzer rounds); this reads the same ledger the in-room socket projects, so
 * ranks match. Server component — fetches with the caller's session token.
 *
 * The API leaderboard is public within the platform, so the same list is shown
 * to students (who see themselves and their colleagues) and to instructors.
 */
export async function Leaderboard({
  courseId,
  highlightUserId,
  limit = 10,
  title = 'Leaderboard',
}: {
  courseId: string;
  /** Highlight this user's row (the signed-in student seeing their own rank). */
  highlightUserId?: string;
  limit?: number;
  title?: string;
}) {
  const token = (await getToken()) ?? undefined;
  const rows = await api<LeaderboardRow[]>(
    `/points/leaderboard?courseId=${courseId}`,
    { token },
  ).catch(() => [] as LeaderboardRow[]);

  return (
    <section className={cn(cardClass, 'p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold tracking-tight text-neutral-950">
          {title}
        </h2>
        <span className="shrink-0 text-xs font-medium text-neutral-400">
          Points from live class
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-8 text-center text-sm text-neutral-500">
          No points yet — students earn points in live class from quizzes and
          buzzer rounds.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.slice(0, limit).map((r) => {
            const me = r.userId === highlightUserId;
            return (
              <li
                key={r.userId}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  me
                    ? 'border-signal-300 bg-signal-50'
                    : 'border-neutral-200 bg-white',
                )}
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-neutral-500">
                  {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
                </span>
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                    avatarColor(r.userId),
                  )}
                  aria-hidden
                >
                  {initials(r.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                  {r.name}
                  {me && (
                    <span className="ml-2 rounded-full bg-signal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      You
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-950">
                  {r.points}
                  <span className="ml-1 text-xs font-medium text-neutral-400">
                    pts
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
