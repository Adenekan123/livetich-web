import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { btn } from '@/lib/ui';
import {
  enabledPluginKeys,
  PLUGIN_CODE_INSTRUCTION,
  PLUGIN_ISLAMIC_EDUCATION,
  PLUGIN_TEST_PREP,
} from '@/lib/plugins';
import type { CourseDetail, LiveSession } from '@/lib/types';
import { ClassRoom } from './class-room';

export default async function SessionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  let session: LiveSession;
  try {
    session = await api<LiveSession>(`/sessions/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const course = await api<CourseDetail>(`/courses/${session.courseId}`, {
    token,
  });
  // Which add-on packs this org has on — gate the pack-specific room surfaces
  // (mushaf + Hifz for Islamic Education; the shared code editor for Code).
  const packs = await enabledPluginKeys(token);
  const islamicEducation = packs.has(PLUGIN_ISLAMIC_EDUCATION);
  const codeInstruction = packs.has(PLUGIN_CODE_INSTRUCTION);
  const testPrep = packs.has(PLUGIN_TEST_PREP);

  if (session.status === 'ENDED') {
    return (
      <>
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <span className="text-4xl">🎬</span>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.02em] text-neutral-950">
            This class has ended
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            The live session for {course.title} is over. Recordings and
            certificates appear on the course page.
          </p>
          <Link
            href={`/courses/${course.id}`}
            className={btn('primary', 'md', 'mt-6')}
          >
            Back to course
          </Link>
        </main>
      </>
    );
  }

  // The classroom renders full-screen (fixed inset-0) with its own top bar.
  return (
    <ClassRoom
      sessionId={id}
      courseId={session.courseId}
      courseTitle={course.title}
      me={{ userId: user.sub, name: user.name, role: user.role }}
      islamicEducation={islamicEducation}
      codeInstruction={codeInstruction}
      testPrep={testPrep}
    />
  );
}
