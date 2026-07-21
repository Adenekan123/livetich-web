import Link from 'next/link';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import type { CourseListItem } from '@/lib/types';

export const metadata = { title: 'Courses — livetich' };

export default async function CoursesPage() {
  const courses = await api<CourseListItem[]>('/courses');
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">Courses</h1>
        {courses.length === 0 ? (
          <p className="mt-6 text-slate-600">No courses yet.</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="block h-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
                >
                  <h2 className="font-semibold">{c.title}</h2>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    {c.instructor.name} · {c._count.sections} sections ·{' '}
                    {c._count.enrollments} enrolled
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
