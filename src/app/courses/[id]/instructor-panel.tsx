import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { avatarColor, initials } from '@/lib/ui';
import type { Certificate, CourseDetail, Enrollment } from '@/lib/types';
import {
  AddSectionForm,
  IssueCertificateForm,
  ScheduleSessionForm,
} from './instructor-forms';

type StudentRow = Pick<Enrollment, 'id'> & {
  student: { id: string; name: string; email: string };
};

function ToolHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-slate-900">{children}</h3>
  );
}

/** Owner-only management: sections, scheduling, students, certificates. */
export async function InstructorPanel({ course }: { course: CourseDetail }) {
  const token = (await getToken())!;
  const [students, certificates] = await Promise.all([
    api<StudentRow[]>(`/courses/${course.id}/students`, { token }),
    api<Certificate[]>(`/certificates/course/${course.id}`, { token }),
  ]);
  const certifiedIds = new Set(certificates.map((c) => c.studentId));
  const uncertified = students.filter((s) => !certifiedIds.has(s.student.id));

  return (
    <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Instructor tools</h2>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
          Owner
        </span>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-10">
        <div className="space-y-7">
          <div>
            <ToolHeading>Add a section</ToolHeading>
            <AddSectionForm courseId={course.id} />
          </div>
          <div>
            <ToolHeading>Schedule a live session</ToolHeading>
            <ScheduleSessionForm
              courseId={course.id}
              sections={course.sections}
            />
          </div>
        </div>

        <div className="space-y-7">
          <div>
            <ToolHeading>Students ({students.length})</ToolHeading>
            {students.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nobody enrolled yet.</p>
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
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {s.student.name}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {s.student.email}
                      </span>
                    </span>
                    {certifiedIds.has(s.student.id) && (
                      <span title="Certified" className="text-base">
                        🎓
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {uncertified.length > 0 && (
            <div>
              <ToolHeading>Issue a certificate</ToolHeading>
              <IssueCertificateForm
                courseId={course.id}
                students={uncertified.map((s) => s.student)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
