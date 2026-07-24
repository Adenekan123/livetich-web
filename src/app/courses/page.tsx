import Link from 'next/link';
import { Header } from '@/components/header';
import { CourseCard } from '@/components/course-card';
import { api } from '@/lib/api';
import type { CourseListItem } from '@/lib/types';

export const metadata = { title: 'Courses - livetich' };

export default async function CoursesPage() {
  const courses = await api<CourseListItem[]>('/courses');
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Live courses
          </h1>
          <p className="mt-1.5 text-slate-500">
            Cohort-based classes taught live. Join a room, participate, and earn
            your place on the leaderboard.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
            <p className="text-4xl">🗓️</p>
            <p className="mt-3 font-medium text-slate-700">No courses yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Check back soon, or{' '}
              <Link
                href="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                start teaching one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                href={`/courses/${c.id}`}
                title={c.title}
                description={c.description}
                meta={[
                  c.instructor.name,
                  `${c._count.sections} sections`,
                  `${c._count.enrollments} enrolled`,
                ]}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
