import {
  formatCadence,
  formatDateRange,
  formatDurationLong,
  tzShort,
} from '@/app/courses/catalog-lib';
import type { InviteCourse } from '@/lib/types';

/**
 * What the program is, for someone deciding whether to press Enroll.
 *
 * A course-scoped invite used to render as "Join Netplus Academy" — the name
 * of the school and nothing about the thing being joined. Somebody who has
 * just paid an instructor and been handed a link should be able to confirm
 * they are in the right place before they hand over a name and a password:
 * which program, which intake, what days, what time, how long, and who is
 * teaching it.
 *
 * Every line is dropped when its fact is missing rather than padded with an
 * em dash, so a sparsely-filled program shows three honest rows instead of
 * seven apologetic ones.
 */
export function ProgramBrief({
  course,
  heading,
}: {
  course: InviteCourse;
  /** The page's own title, so the card never repeats it back. */
  heading?: string;
}) {
  const cadence = formatCadence(course.meetingDays, course.meetingTime);
  const zone = tzShort(course.timezone, course.startDate);
  const duration = formatDurationLong(course.durationWeeks);
  const dates = course.startDate
    ? formatDateRange(course.startDate, course.durationWeeks ?? null)
    : null;

  const rows: { label: string; value: string }[] = [];
  if (cadence) rows.push({ label: 'Meets', value: zone ? `${cadence} (${zone})` : cadence });
  if (dates) rows.push({ label: 'Runs', value: dates });
  if (duration) rows.push({ label: 'Length', value: duration });
  if (course.instructor?.name) {
    rows.push({ label: 'Taught by', value: course.instructor.name });
  }
  if (course.level) rows.push({ label: 'Level', value: course.level });

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 text-left">
      {course.parentCourse?.title &&
        course.parentCourse.title !== heading && (
          <p className="text-sm font-semibold text-signal-700">
            {course.parentCourse.title}
          </p>
        )}
      {course.title !== heading && (
        <p className="mt-0.5 font-display text-lg font-bold tracking-[-0.01em] text-neutral-950">
          {course.title}
        </p>
      )}

      {course.description && (
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {course.description}
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-3 py-2.5 text-sm">
              <dt className="w-24 shrink-0 text-neutral-500">{row.label}</dt>
              <dd className="min-w-0 font-medium text-neutral-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
