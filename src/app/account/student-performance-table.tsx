import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { StudentStat } from '@/lib/types';

function Num({ value, muted }: { value: string | number; muted?: boolean }) {
  return (
    <td className={cn('px-4 py-3.5 text-right font-mono text-sm', muted ? 'text-neutral-400' : 'text-neutral-800')}>
      {value}
    </td>
  );
}

/**
 * Student roster with performance. Points, interactions (chat + quiz answers),
 * and attendance come from real data; assignment submissions have no model yet,
 * so that column is shown as not-tracked rather than fabricated.
 */
export function StudentPerformanceTable({
  students,
  showPrograms = false,
  emptyLabel = 'No students yet.',
  renderRowAction,
}: {
  students: StudentStat[];
  scoped?: boolean;
  showPrograms?: boolean;
  emptyLabel?: string;
  renderRowAction?: (student: StudentStat) => React.ReactNode;
}) {
  const cols = 5 + (showPrograms ? 1 : 0) + (renderRowAction ? 1 : 0);
  return (
    <>
      <div className={cn(cardClass, 'mt-6 overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Student</th>
                {showPrograms && <th className="px-4 py-3 text-right">Programs</th>}
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Interactions</th>
                <th className="px-4 py-3 text-right">Attendance</th>
                <th className="px-4 py-3 text-right">Assignments</th>
                {renderRowAction && <th className="px-4 py-3 text-right" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-12 text-center text-neutral-500">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                            avatarColor(s.id),
                          )}
                          aria-hidden
                        >
                          {initials(s.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{s.name}</p>
                          <p className="truncate text-xs text-neutral-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    {showPrograms && <Num value={s.enrolledCourseIds.length} />}
                    <Num value={s.points} />
                    <Num value={s.interactions} />
                    <Num
                      value={s.held > 0 ? `${s.attended}/${s.held}` : s.attended}
                      muted={s.attended === 0}
                    />
                    <Num
                      value={
                        s.assignmentsTotal > 0
                          ? `${s.assignmentsSubmitted}/${s.assignmentsTotal}`
                          : '—'
                      }
                      muted={s.assignmentsSubmitted === 0}
                    />
                    {renderRowAction && (
                      <td className="px-4 py-3.5 text-right">{renderRowAction(s)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Points are earned in live sessions; interactions count chat messages and quiz/buzzer
        answers; attendance counts live sessions joined out of sessions held; assignments show
        submissions out of assignments set.
      </p>
    </>
  );
}
