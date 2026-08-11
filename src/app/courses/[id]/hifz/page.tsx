import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type {
  CourseDetail,
  HifzOverviewRow,
  MyHifz,
  Surah,
} from '@/lib/types';
import { HifzManager } from './hifz-manager';
import { MyHifzPanel } from './my-hifz';

export default async function HifzPage(props: {
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
  const canManage = isOwner || user.role === 'ORG_ADMIN';

  const { surahs, totalAyahs } = await api<{
    surahs: Surah[];
    totalAyahs: number;
  }>('/quran/surahs', { token });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← {course.title}
        </Link>
        <div className="mt-4">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
            Hifz &amp; memorization
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            {canManage
              ? "Set each student a surah/ayah target, log their recitations (new memorization or muraja'ah revision), and track progress across the Qur'an."
              : "Your memorization targets and recitation log for this class."}
          </p>
        </div>

        {canManage ? (
          <ManagerView
            courseId={id}
            token={token}
            surahs={surahs}
            totalAyahs={totalAyahs}
          />
        ) : (
          <StudentView
            courseId={id}
            token={token}
            surahs={surahs}
            totalAyahs={totalAyahs}
          />
        )}
      </main>
    </>
  );
}

async function ManagerView({
  courseId,
  token,
  surahs,
  totalAyahs,
}: {
  courseId: string;
  token: string;
  surahs: Surah[];
  totalAyahs: number;
}) {
  const rows = await api<HifzOverviewRow[]>(`/courses/${courseId}/hifz`, {
    token,
  });
  return (
    <HifzManager
      courseId={courseId}
      rows={rows}
      surahs={surahs}
      totalAyahs={totalAyahs}
    />
  );
}

async function StudentView({
  courseId,
  token,
  surahs,
  totalAyahs,
}: {
  courseId: string;
  token: string;
  surahs: Surah[];
  totalAyahs: number;
}) {
  let mine: MyHifz;
  try {
    mine = await api<MyHifz>(`/courses/${courseId}/hifz/mine`, { token });
  } catch (e) {
    // Not enrolled → the API forbids it; nothing to show here.
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      notFound();
    }
    throw e;
  }
  return <MyHifzPanel mine={mine} surahs={surahs} totalAyahs={totalAyahs} />;
}
