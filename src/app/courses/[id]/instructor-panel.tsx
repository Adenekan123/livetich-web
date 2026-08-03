import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { avatarColor, initials } from '@/lib/ui';
import type { CourseDetail, Enrollment } from '@/lib/types';
import { AddSectionForm } from './instructor-forms';

type StudentRow = Pick<Enrollment, 'id'> & {
  student: { id: string; name: string; email: string };
};

function ToolHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-neutral-900">{children}</h3>
  );
}

/** Owner-only management: sections and the enrolled roster. Live classes now
 *  run off the program cadence — nothing to schedule here. */
export async function InstructorPanel({ course }: { course: CourseDetail }) {
  const token = (await getToken())!;
  const students = await api<StudentRow[]>(
    `/courses/${course.id}/students`,
    { token },
  );

  return (
    <section className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Instructor tools</h2>
        <span className="rounded-full bg-signal-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-signal-700">
          Owner
        </span>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-10">
        <div className="space-y-7">
          <div>
            <ToolHeading>Add a section</ToolHeading>
            <AddSectionForm courseId={course.id} />
          </div>
        </div>

        <div className="space-y-7">
          <div>
            <ToolHeading>Students ({students.length})</ToolHeading>
            {students.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Nobody enrolled yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                        s.student.id,
                      )}`}
                      aria-hidden
                    >
                      {initials(s.student.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-800">
                        {s.student.name}
                      </span>
                      <span className="block truncate text-xs text-neutral-400">
                        {s.student.email}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
