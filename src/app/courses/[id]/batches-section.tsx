import Link from 'next/link';
import { btn, cn } from '@/lib/ui';
import type { CourseBatch } from '@/lib/types';
import { deriveCohort, formatCadence, tzShort } from '../catalog-lib';
import { AddBatchButton } from './add-batch-modal';

/** Compact status chip mirroring the catalog's monochrome tones. */
function BatchStatus({ live, label }: { live: boolean; label: string }) {
  if (live) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        <span className="animate-live h-1.5 w-1.5 rounded-full bg-white" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
      {label}
    </span>
  );
}

/**
 * The batches (scheduled instances) of a program. Managers get an "Add batch"
 * control and manage links; everyone else sees each batch's own schedule and a
 * way in — students pick the batch whose time (and timezone) suits them and
 * enrol on that batch's page.
 */
export function BatchesSection({
  programId,
  batches,
  canManage,
  defaultWeeks,
  defaultTimezone,
  enrolledCourseIds,
}: {
  programId: string;
  batches: CourseBatch[];
  canManage: boolean;
  defaultWeeks: number | null;
  defaultTimezone: string | null;
  /** Batch ids the viewing student is enrolled in (to label "Open" vs "Enrol"). */
  enrolledCourseIds: Set<string>;
}) {
  return (
    <section id="batches" className="scroll-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
          Batches
        </h2>
        <span className="h-px flex-1 bg-neutral-200" />
        {canManage && (
          <AddBatchButton
            programId={programId}
            defaultWeeks={defaultWeeks}
            defaultTimezone={defaultTimezone}
          />
        )}
      </div>

      {batches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          {canManage
            ? 'No batches yet. Add one to run this program at another time or timezone — its curriculum and assessments are copied over automatically.'
            : 'No batches scheduled yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {batches.map((b) => {
            const live = Boolean(b.liveSessionId);
            const cohort = deriveCohort(b.startDate, b.durationWeeks, live);
            const cadence = formatCadence(b.meetingDays, b.meetingTime);
            const tz = tzShort(b.timezone, b.startDate);
            // A batch title is "Program — Label"; show just the label part.
            const label = b.title.includes(' — ')
              ? b.title.slice(b.title.indexOf(' — ') + 3)
              : b.title;
            const enrolled = enrolledCourseIds.has(b.id);
            return (
              <li key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-neutral-900">
                      {label}
                    </span>
                    <BatchStatus live={live} label={cohort.label} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-neutral-500">
                    {cadence ?? 'Schedule to be announced'}
                    {cadence && tz && (
                      <span className="text-neutral-400"> {tz}</span>
                    )}
                    <span className="mx-1.5 text-neutral-300">·</span>
                    {b._count.enrollments}{' '}
                    {b._count.enrollments === 1 ? 'student' : 'students'}
                    {b.instructor?.name && (
                      <>
                        <span className="mx-1.5 text-neutral-300">·</span>
                        {b.instructor.name}
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href={`/courses/${b.id}`}
                  className={cn(
                    btn(enrolled || canManage ? 'secondary' : 'primary', 'sm'),
                    'shrink-0',
                  )}
                >
                  {canManage ? 'Manage' : enrolled ? 'Open' : 'View & enrol'}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
