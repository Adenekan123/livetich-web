import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { CourseDetail } from '@/lib/types';
import { BuzzerBank, type BuzzerQuiz } from '../buzzer-bank';

export const metadata = { title: 'Buzzer questions — livetich' };

export default async function BuzzerQuestionsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const isOwner = user.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  if (!isOwner && user.role !== 'ORG_ADMIN') redirect(`/courses/${id}`);

  const quizzes = await api<BuzzerQuiz[]>(`/quizzes?courseId=${id}`, {
    token,
  }).catch(() => [] as BuzzerQuiz[]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href={`/courses/${id}`}
        className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
      >
        ← {course.title}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
        Buzzer questions
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Build a bank of buzzer questions for this program. Any of them can be
        launched in a live class — or add one on the spot from the room.
      </p>
      <BuzzerBank courseId={id} quizzes={quizzes} />
    </main>
  );
}
