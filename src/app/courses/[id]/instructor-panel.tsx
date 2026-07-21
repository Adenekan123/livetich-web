import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { Certificate, CourseDetail, Enrollment } from '@/lib/types';
import {
  AddSectionForm,
  IssueCertificateForm,
  ScheduleSessionForm,
} from './instructor-forms';

type StudentRow = Pick<Enrollment, 'id'> & {
  student: { id: string; name: string; email: string };
};

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
    <section className="mt-12 rounded-lg border border-indigo-200 bg-indigo-50/50 p-6">
      <h2 className="text-lg font-semibold text-indigo-900">
        Instructor tools
      </h2>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Add a section</h3>
          <AddSectionForm courseId={course.id} />
          <h3 className="mt-6 text-sm font-semibold text-slate-700">
            Schedule a live session
          </h3>
          <ScheduleSessionForm courseId={course.id} sections={course.sections} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Students ({students.length})
          </h3>
          {students.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Nobody enrolled yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span>
                    {s.student.name}
                    <span className="ml-2 text-xs text-slate-400">
                      {s.student.email}
                    </span>
                  </span>
                  {certifiedIds.has(s.student.id) && <span title="Certified">🎓</span>}
                </li>
              ))}
            </ul>
          )}
          {uncertified.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-slate-700">
                Issue a certificate
              </h3>
              <IssueCertificateForm
                courseId={course.id}
                students={uncertified.map((s) => s.student)}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
