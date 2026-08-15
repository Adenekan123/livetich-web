import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiBookOpenText,
  PiClipboardText,
  PiClockCounterClockwise,
  PiNotePencil,
  PiUsers,
} from 'react-icons/pi';
import { enroll, unenroll } from '@/app/actions/courses';
import { Header } from '@/components/header';
import { SubmitButton } from '@/components/submit-button';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_ISLAMIC_EDUCATION } from '@/lib/plugins';
import { btn, cardClass, cn } from '@/lib/ui';
import type { Certificate, CourseDetail, Enrollment } from '@/lib/types';
import {
  deriveCohort,
  formatCadence,
  formatDateRange,
  formatDurationLong,
  tzShort,
  type CohortStatus,
} from '../catalog-lib';
import { InstructorPanel } from './instructor-panel';
import { AddSectionButton } from './add-section-modal';
import { ClassReminderCard } from './class-reminder-card';
import { JoinLiveCard } from './join-live-card';

/* Server-rendered cohort status pill (mirrors the catalog's monochrome styles). */
function StatusPill({ status, label }: { status: CohortStatus; label: string }) {
  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
        <span className="animate-live h-1.5 w-1.5 rounded-full bg-white" />
        {label}
      </span>
    );
  }
  const styles: Record<Exclude<CohortStatus, 'LIVE'>, string> = {
    STARTING_SOON: 'bg-neutral-950 text-white',
    ENROLLING: 'border border-neutral-300 bg-white text-neutral-800',
    OPEN: 'border border-neutral-300 bg-white text-neutral-800',
    IN_PROGRESS: 'bg-neutral-100 text-neutral-700',
    COMPLETED: 'bg-neutral-100 text-neutral-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        styles[status],
      )}
    >
      {status === 'ENROLLING' && <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />}
      {label}
    </span>
  );
}

/* Link card to a program sub-page (roster, assignments, session history). */
function NavCard({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: IconType;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        'group flex items-center gap-4 p-5 transition hover:border-neutral-300 hover:shadow-sm',
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-950">{title}</p>
        <p className="mt-0.5 truncate text-sm text-neutral-500">{desc}</p>
      </div>
      <span className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500">
        →
      </span>
    </Link>
  );
}

/* One labelled fact in the cohort summary strip. */
function Fact({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-neutral-950">{value}</dd>
      {sub && <dd className="truncate text-xs text-neutral-400">{sub}</dd>}
    </div>
  );
}

export default async function CoursePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!token) redirect('/login');

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const sessionStatus = await api<{
    joinableNow: boolean;
    isLive: boolean;
    nextAt: string | null;
  }>(`/sessions/course/${id}/status`, { token });

  const isOwner = user?.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  const canManage = isOwner || user?.role === 'ORG_ADMIN';
  const isAdmin = user?.role === 'ORG_ADMIN';
  // Hifz lives behind the Islamic Education pack — hide the card when it's off.
  const islamicEducation = token
    ? await isPluginEnabled(PLUGIN_ISLAMIC_EDUCATION, token)
    : false;
  let isEnrolled = false;
  let myReminderAddedAt: string | null = null;
  if (user?.role === 'STUDENT' && token) {
    const enrollments = await api<Enrollment[]>('/courses/enrolled', { token });
    const mine = enrollments.find((e) => e.courseId === id);
    isEnrolled = Boolean(mine);
    myReminderAddedAt = mine?.reminderAddedAt ?? null;
  }

  let myCertificate: Certificate | undefined;
  if (isEnrolled && token) {
    const certs = await api<Certificate[]>('/certificates/mine', { token });
    myCertificate = certs.find((c) => c.courseId === id);
  }

  const liveNow = sessionStatus.isLive;
  const cohort = deriveCohort(course.startDate, course.durationWeeks, liveNow);
  const cadence = formatCadence(course.meetingDays, course.meetingTime);
  const tz = tzShort(course.timezone, course.startDate);
  const duration = formatDurationLong(course.durationWeeks);
  const dateRange = course.startDate
    ? formatDateRange(course.startDate, course.durationWeeks)
    : null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        {/* Course header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Link href="/courses" className="hover:text-neutral-700">
                Programs
              </Link>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-400">{course.category ?? 'Program'}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-950">
                {course.title}
              </h1>
              <StatusPill status={cohort.status} label={cohort.label} />
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Taught by{' '}
              <span className="font-medium text-neutral-700">
                {course.instructor?.name ?? 'To be assigned'}
              </span>
              {course.level && <> · {course.level}</>} ·{' '}
              {course._count.enrollments}{' '}
              {course._count.enrollments === 1 ? 'student' : 'students'} enrolled
            </p>
            {course.description && (
              <p className="mt-4 text-neutral-700">{course.description}</p>
            )}
          </div>

          <div className="shrink-0">
            {user?.role === 'STUDENT' && (
              <form
                action={
                  isEnrolled ? unenroll.bind(null, id) : enroll.bind(null, id)
                }
              >
                <SubmitButton
                  variant={isEnrolled ? 'secondary' : 'primary'}
                  size="lg"
                  pendingLabel={isEnrolled ? 'Leaving…' : 'Enrolling…'}
                >
                  {isEnrolled ? 'Enrolled ✓' : 'Enroll in cohort'}
                </SubmitButton>
              </form>
            )}
            {!user && (
              <Link href="/login" className={btn('primary', 'lg')}>
                Log in to enroll
              </Link>
            )}
          </div>
        </div>

        {/* Cohort summary */}
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-4 sm:p-6">
          <Fact
            label="Schedule"
            value={cadence ?? 'To be announced'}
            sub={cadence && tz ? tz : null}
          />
          <Fact label="Duration" value={duration ?? 'Self-paced'} />
          <Fact
            label={cohort.status === 'COMPLETED' ? 'Ran' : 'Dates'}
            value={dateRange ?? 'To be scheduled'}
          />
          <Fact label="Certificate" value="On completion" sub="Verifiable" />
        </dl>

        {myCertificate && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-signal-200 bg-signal-50 px-4 py-3.5 text-sm text-signal-800">
            <span className="text-lg leading-none">🎓</span>
            <p>
              You hold a certificate for this course (code{' '}
              <span className="font-mono">{myCertificate.verificationCode}</span>
              ). Download it from your{' '}
              <Link href="/dashboard" className="font-medium underline">
                dashboard
              </Link>
              .
            </p>
          </div>
        )}

        {/* Live class — only participants (owner instructor / enrolled) can join */}
        {(isOwner || isEnrolled) && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-neutral-900">Live class</h2>
            <JoinLiveCard
              courseId={id}
              canJoin={isOwner || isEnrolled}
              isInstructor={isOwner}
              joinableNow={sessionStatus.joinableNow}
              isLive={sessionStatus.isLive}
              nextAt={sessionStatus.nextAt}
              timezone={course.timezone}
            />
            {isEnrolled && (
              <ClassReminderCard
                courseId={id}
                cadence={cadence}
                reminderAddedAt={myReminderAddedAt}
                scheduleUpdatedAt={course.scheduleUpdatedAt}
              />
            )}
          </section>
        )}

        {/* Program navigation — roster / assignments / session history on their own pages */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-neutral-900">Tools</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(canManage || isEnrolled) && (
              <NavCard
                href={`/courses/${id}/assignments`}
                icon={PiNotePencil}
                title={canManage ? 'Assignment lab' : 'Assignments'}
                desc={
                  canManage
                    ? 'Coursework, groups, grading & submissions'
                    : 'View and submit coursework'
                }
              />
            )}
            {(canManage || isEnrolled) && (
              <NavCard
                href={`/courses/${id}/assessment`}
                icon={PiClipboardText}
                title="Assessments"
                desc={
                  canManage
                    ? 'Question bank + remediation tasks'
                    : 'Post-class quizzes and practice'
                }
              />
            )}
            {islamicEducation && (canManage || isEnrolled) && (
              <NavCard
                href={`/courses/${id}/hifz`}
                icon={PiBookOpenText}
                title="Hifz & memorization"
                desc={
                  canManage
                    ? 'Set targets, log recitations, track progress'
                    : 'Your memorization targets and recitation log'
                }
              />
            )}
            <NavCard
              href={`/courses/${id}/sessions`}
              icon={PiClockCounterClockwise}
              title="Session history"
              desc="Every live session held so far"
            />
            {isAdmin && (
              <NavCard
                href={`/courses/${id}/roster`}
                icon={PiUsers}
                title="Roster"
                desc="Enrolment and certificates"
              />
            )}
          </div>
        </section>

        {/* Curriculum */}
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-900">Curriculum</h2>
            {canManage && <AddSectionButton courseId={id} />}
          </div>
          {course.sections.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
              {canManage
                ? 'No sections yet. Add the first one to outline this program.'
                : 'No sections yet.'}
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {course.sections.map((s) => (
                <li key={s.id} className="flex items-start gap-4 px-5 py-3.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                    {s.order}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-800">{s.title}</span>
                    {s.description && (
                      <span className="mt-0.5 block text-sm text-neutral-500">
                        {s.description}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isOwner && <InstructorPanel course={course} />}
      </main>
    </>
  );
}
