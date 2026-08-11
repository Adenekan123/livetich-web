import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CourseDetail, Enrollment } from '@/lib/types';
import { StudentRosterTable, type RosterStudent } from './student-roster-table';

type StudentRow = Pick<Enrollment, 'id' | 'createdAt' | 'reminderAddedAt'> & {
  student: { id: string; name: string; email: string };
};

/** Owner-only student roster for the course. Curriculum sections are managed
 *  from the Curriculum section's "Add section" modal; live classes run off the
 *  program cadence — nothing to schedule here. */
export async function InstructorPanel({ course }: { course: CourseDetail }) {
  const token = (await getToken())!;
  const students = await api<StudentRow[]>(
    `/courses/${course.id}/students`,
    { token },
  );

  return (
    <section className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Student roster</h2>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
          {students.length}
        </span>
        <span className="rounded-full bg-signal-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-signal-700">
          Owner
        </span>
      </div>

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nobody enrolled yet.</p>
      ) : (
        <StudentRosterTable students={students as RosterStudent[]} />
      )}
    </section>
  );
}
