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
  searchParams: Promise<{ as?: string }>;
}) {
  const { id } = await props.params;
  const { as } = await props.searchParams;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');
  // A solo-teacher admin can enter as the instructor (?as=teach). The API
  // re-validates org ownership when minting the token and on the socket join;
  // this only drives which room UI the admin sees.
  const teaching = user.role === 'ORG_ADMIN' && as === 'teach';

  let session: LiveSession;
  try {
    session = await api<LiveSession>(`/sessions/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  // The course fetch is org-scoped (unlike the public session read), so a
  // session whose course the caller can't see 404s here — treat that as a
  // missing page rather than letting it crash the classroom with a 500.
  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${session.courseId}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
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
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-signal-50 text-signal-700 ring-1 ring-signal-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
              <path
                d="M8 5v14l11-7L8 5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.02em] text-neutral-950">
            This class has ended
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            The live session for {course.title} has wrapped up. Head back to the
            program for its schedule and coursework — and once your instructor
            issues your certificate, it&apos;ll appear on your dashboard.
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
      teaching={teaching}
      islamicEducation={islamicEducation}
      codeInstruction={codeInstruction}
      testPrep={testPrep}
      tldrawLicenseKey={process.env.TLDRAW_LICENSE_KEY}
    />
  );
}
