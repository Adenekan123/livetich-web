import Link from 'next/link';
import { btn, cn } from '@/lib/ui';
import type { CourseBatch, CourseDetail } from '@/lib/types';
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
 * Cohorts overview and management. Lets managers create additional schedule
 * options and lets learners switch the active cohort in the cockpit.
 */
export function BatchesSection({
  programId,
  batches,
  activeCohortId,
  canManage,
  defaultWeeks,
  defaultTimezone,
  defaultTime,
  defaultDays,
  enrolledCourseIds,
  course,
}: {
  programId: string;
  batches: CourseBatch[];
  activeCohortId?: string;
  canManage: boolean;
  defaultWeeks: number | null;
  defaultTimezone: string | null;
  defaultTime?: string | null;
  defaultDays?: number[] | null;
  /** Batch ids the viewing student is enrolled in (to label "Open" vs "Enrol"). */
  enrolledCourseIds: Set<string>;
  course?: CourseDetail;
}) {
  const isBaseSelected = !activeCohortId || activeCohortId === 'base' || activeCohortId === programId;
  const baseCadence = course ? formatCadence(course.meetingDays, course.meetingTime) : null;
  const baseTz = course ? tzShort(course.timezone, course.startDate) : null;
  const baseEnrolled = course ? enrolledCourseIds.has(course.id) : false;
  const baseCohort = course ? deriveCohort(course.startDate, course.durationWeeks, false) : null;

  return (
    <section id="batches" className="scroll-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
          Cohorts &amp; Intakes
        </h2>
        <span className="h-px flex-1 bg-neutral-200" />
        {canManage && (
          <AddBatchButton
            programId={programId}
            defaultWeeks={defaultWeeks}
            defaultTimezone={defaultTimezone}
            defaultTime={defaultTime}
            defaultDays={defaultDays}
          />
        )}
      </div>

      {batches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          {canManage
            ? 'Running this program on a single schedule. Add another cohort if you need to offer multiple meeting times (e.g. Morning vs Evening).'
            : 'This program runs as a single cohort.'}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {/* Base Program (Initial Program) */}
          {course && (
            <li
              className={cn(
                'flex items-center gap-4 px-5 py-3.5 transition-colors',
                isBaseSelected && 'bg-signal-50/30',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-neutral-900">
                    {course.title}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 font-mono">
                    Base / Initial
                  </span>
                  {baseCohort && <BatchStatus live={false} label={baseCohort.label} />}
                  {baseEnrolled && (
                    <span className="rounded-full bg-signal-100 px-2 py-0.5 text-[10px] font-bold text-signal-800">
                      Enrolled
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-neutral-500">
                  {baseCadence ?? 'Schedule to be announced'}
                  {baseCadence && baseTz && (
                    <span className="text-neutral-400"> {baseTz}</span>
                  )}
                  <span className="mx-1.5 text-neutral-300">·</span>
                  {course._count.enrollments}{' '}
                  {course._count.enrollments === 1 ? 'student' : 'students'}
                  {course.instructor?.name && (
                    <>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      {course.instructor.name}
                    </>
                  )}
                </p>
              </div>
              <Link
                href={`/courses/${programId}?cohort=base`}
                className={cn(
                  btn(isBaseSelected ? 'secondary' : baseEnrolled || canManage ? 'secondary' : 'primary', 'sm'),
                  'shrink-0',
                  isBaseSelected && 'border-signal-600 bg-signal-50 font-bold text-signal-800 ring-1 ring-signal-600',
                )}
              >
                {isBaseSelected ? 'Active cohort' : baseEnrolled ? 'Switch to' : canManage ? 'Select' : 'Select & enrol'}
              </Link>
            </li>
          )}
          {batches.map((b) => {
            const isSelected = b.id === activeCohortId;
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
              <li
                key={b.id}
                className={cn(
                  'flex items-center gap-4 px-5 py-3.5 transition-colors',
                  isSelected && 'bg-signal-50/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-neutral-900">
                      {label}
                    </span>
                    <BatchStatus live={live} label={cohort.label} />
                    {enrolled && (
                      <span className="rounded-full bg-signal-100 px-2 py-0.5 text-[10px] font-bold text-signal-800">
                        Enrolled
                      </span>
                    )}
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
                  href={`/courses/${programId}?cohort=${b.id}`}
                  className={cn(
                    btn(isSelected ? 'secondary' : enrolled || canManage ? 'secondary' : 'primary', 'sm'),
                    'shrink-0',
                    isSelected && 'border-signal-600 bg-signal-50 font-bold text-signal-800 ring-1 ring-signal-600',
                  )}
                >
                  {isSelected ? 'Active cohort' : enrolled ? 'Switch to' : canManage ? 'Select' : 'Select & enrol'}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
