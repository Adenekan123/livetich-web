import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiBookOpenText,
  PiClipboardText,
  PiClockCounterClockwise,
  PiExam,
  PiLightning,
  PiNotePencil,
  PiUsers,
} from 'react-icons/pi';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import {
  isPluginEnabled,
  PLUGIN_ISLAMIC_EDUCATION,
  PLUGIN_TEST_PREP,
} from '@/lib/plugins';
import { cardClass, cn } from '@/lib/ui';
import type {
  AssessmentQuestion,
  Certificate,
  CourseDetail,
  Enrollment,
  MyAssignment,
  OrgInvite,
} from '@/lib/types';
import {
  deriveCohort,
  formatCadence,
  formatDateRange,
  formatDurationLong,
  tzShort,
  type CohortStatus,
} from '../catalog-lib';
import { EnrollActions } from './enroll-actions';
import { InstructorPanel } from './instructor-panel';
import { CourseInviteManage } from './course-invite-manage';
import { AddSectionButton } from './add-section-modal';
import { ClassReminderCard } from './class-reminder-card';
import { JoinLiveCard } from './join-live-card';
import { ShadowJoinCard } from './shadow-join-card';
import { EditProgramButton } from './edit-program-modal';
import { AssessmentGate } from './assessment-gate';
import { Leaderboard } from '@/components/leaderboard';

/* Server-rendered cohort status pill (mirrors the catalog's monochrome styles). */
function StatusPill({ status, label }: { status: CohortStatus; label: string }) {
  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
        <span className="animate-live h-1.5 w-1.5 rounded-full bg-white" />
        {label}
      </span>
    );
  }
  const styles: Record<Exclude<CohortStatus, 'LIVE'>, string> = {
    STARTING_SOON: 'bg-accent-100 text-accent-700',
    ENROLLING: 'border border-neutral-300 bg-white text-neutral-800',
    OPEN: 'border border-neutral-300 bg-white text-neutral-800',
    IN_PROGRESS: 'bg-signal-50 text-signal-800',
    COMPLETED: 'bg-neutral-100 text-neutral-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        styles[status],
      )}
    >
      {status === 'ENROLLING' && <span className="h-1.5 w-1.5 rounded-full bg-signal-600" />}
      {label}
    </span>
  );
}

/* A teaching-tool card in the main column's "Teach" grid. */
function ToolCard({
  href,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: IconType;
  title: string;
  desc: string;
  /** Optional count pill (e.g. pending assignments) shown by the title. */
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        'group flex items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm',
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal-700 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold text-neutral-950">
          {title}
          {badge != null && badge > 0 && (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-500 px-1.5 py-0.5 text-[11px] font-bold text-neutral-950"
              title={`${badge} pending`}
            >
              {badge}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-neutral-500">{desc}</p>
      </div>
      <span className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500">
        →
      </span>
    </Link>
  );
}

/* A demoted "records" link (session history, roster) — lighter than a tool card. */
function RecordLink({ href, icon: Icon, label }: { href: string; icon: IconType; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50"
    >
      <Icon className="h-[18px] w-[18px] text-signal-700" />
      {label}
      <span className="text-neutral-300">→</span>
    </Link>
  );
}

/* Section label with a rule and optional trailing action. */
function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
        {children}
      </h2>
      <span className="h-px flex-1 bg-neutral-200" />
      {action}
    </div>
  );
}

/* Rail: compact cohort facts. */
function FactsCard({
  schedule,
  tz,
  duration,
  dates,
  datesLabel,
}: {
  schedule: string | null;
  tz: string | null;
  duration: string | null;
  dates: string | null;
  datesLabel: string;
}) {
  const rows: { k: string; v: string; sub?: string | null }[] = [
    { k: 'Schedule', v: schedule ?? 'To be announced', sub: schedule ? tz : null },
    { k: 'Duration', v: duration ?? 'Self-paced' },
    { k: datesLabel, v: dates ?? 'To be scheduled' },
    { k: 'Certificate', v: 'On completion', sub: 'Verifiable' },
  ];
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <p className="border-b border-neutral-100 px-4 py-3 font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
        Details
      </p>
      <dl className="px-4">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-3 border-t border-neutral-100 py-2.5 first:border-t-0">
            <dt className="text-[13px] text-neutral-500">{r.k}</dt>
            <dd className="text-right text-[13.5px] font-semibold text-neutral-900">
              {r.v}
              {r.sub && <span className="block text-[11.5px] font-normal text-neutral-400">{r.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* Rail: next-session card for admins (who don't join the room themselves). */
function NextSessionCard({ live, when }: { live: boolean; when: string | null }) {
  return (
    <div className={cn(cardClass, 'overflow-hidden border-lime-100')}>
      <div className="bg-gradient-to-b from-lime-50 to-white p-4">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-lime-700">
          {live && <span className="animate-live h-1.5 w-1.5 rounded-full bg-lime-500" />}
          {live ? 'In session' : 'Next session'}
        </p>
        <p className="mt-2 text-[17px] font-extrabold tracking-tight text-neutral-950">
          {when ?? 'Not scheduled'}
        </p>
        {!live && when && <p className="mt-0.5 text-[12.5px] text-neutral-500">The instructor opens the room.</p>}
      </div>
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
  const testPrep = token
    ? await isPluginEnabled(PLUGIN_TEST_PREP, token)
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

  // Pending coursework in this program — surfaced as a badge on the student's
  // Assignments card so they can see there's work waiting without opening it.
  let pendingAssignments = 0;
  if (isEnrolled && token) {
    const mineAssignments = await api<MyAssignment[]>('/assignments/mine', {
      token,
    }).catch(() => [] as MyAssignment[]);
    pendingAssignments = mineAssignments.filter(
      (a) => a.courseId === id && !a.submitted,
    ).length;
  }

  // Instructor go-live guard: if this program has no authored assessment
  // questions, no post-class quiz will materialize — warn before going live.
  let hasAssessment = true;
  if (isOwner && token) {
    const questions = await api<AssessmentQuestion[]>(
      `/courses/${id}/assessment/questions`,
      { token },
    ).catch(() => [] as AssessmentQuestion[]);
    hasAssessment = questions.length > 0;
  }

  // Admin management is invite-first: fetch this program's scoped invite links.
  let courseInvites: OrgInvite[] = [];
  if (isAdmin) {
    courseInvites = await api<OrgInvite[]>(
      `/organizations/invites?courseId=${id}`,
      { token },
    ).catch(() => []);
  }

  const liveNow = sessionStatus.isLive;
  const cohort = deriveCohort(course.startDate, course.durationWeeks, liveNow);
  const cadence = formatCadence(course.meetingDays, course.meetingTime);
  const tz = tzShort(course.timezone, course.startDate);
  const duration = formatDurationLong(course.durationWeeks);
  const dateRange = course.startDate
    ? formatDateRange(course.startDate, course.durationWeeks)
    : null;
  const nextWhen = sessionStatus.nextAt
    ? new Date(sessionStatus.nextAt).toLocaleString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: course.timezone ?? undefined,
      })
    : null;

  // The teaching tools that appear in the main column's "Teach" grid.
  const canUseTools = canManage || isEnrolled;
  const teachTools: {
    href: string;
    icon: IconType;
    title: string;
    desc: string;
    badge?: number;
  }[] = [];
  if (canUseTools) {
    teachTools.push({
      href: `/courses/${id}/assignments`,
      icon: PiNotePencil,
      title: canManage ? 'Assignment lab' : 'Assignments',
      desc: canManage ? 'Coursework, groups, grading & submissions' : 'View and submit coursework',
      ...(!canManage && pendingAssignments > 0
        ? { badge: pendingAssignments }
        : {}),
    });
    teachTools.push({
      href: `/courses/${id}/assessment`,
      icon: PiClipboardText,
      title: 'Assessments',
      desc: canManage ? 'Question bank + remediation tasks' : 'Post-class quizzes and practice',
    });
    if (canManage) {
      teachTools.push({
        href: `/courses/${id}/buzzer`,
        icon: PiLightning,
        title: 'Buzzer questions',
        desc: 'Build a bank of live buzzer rounds',
      });
    }
    if (testPrep) {
      teachTools.push({
        href: `/courses/${id}/exams`,
        icon: PiExam,
        title: 'Test Prep',
        desc: canManage ? 'Build timed mock exams; import past questions' : 'Sit timed practice exams',
      });
    }
    if (islamicEducation) {
      teachTools.push({
        href: `/courses/${id}/hifz`,
        icon: PiBookOpenText,
        title: 'Hifz & memorization',
        desc: canManage ? 'Set targets, log recitations, track progress' : 'Your memorization targets and recitation log',
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-9 sm:px-6 lg:px-8">
      {/* Class-end assessment gate: enrolled students with a pending quiz are
          blocked until they start it. */}
      {user?.role === 'STUDENT' && isEnrolled && <AssessmentGate courseId={id} />}

      {/* Header */}
      <div className="max-w-3xl">
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
          {canManage && (
            <span className="sm:ml-auto">
              <EditProgramButton course={course} />
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Taught by{' '}
          <span className="font-medium text-neutral-700">
            {course.instructor?.name ?? 'To be assigned'}
          </span>
          {course.level && <> · {course.level}</>} · {course._count.enrollments}{' '}
          {course._count.enrollments === 1 ? 'student' : 'students'} enrolled
        </p>
        {course.description && <p className="mt-4 text-neutral-700">{course.description}</p>}
      </div>

      {/* Two-column: main content + sticky cockpit rail. On mobile the rail
          (live action + facts) leads, then the teaching content. */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* MAIN */}
        <div className="order-2 min-w-0 space-y-10 lg:order-1">
          {teachTools.length > 0 && (
            <section>
              <SectionLabel>Teach</SectionLabel>
              <div className="grid gap-3 xl:grid-cols-2">
                {teachTools.map((t) => (
                  <ToolCard key={t.href} {...t} />
                ))}
              </div>
            </section>
          )}

          {/* Curriculum */}
          <section>
            <SectionLabel action={canManage ? <AddSectionButton courseId={id} /> : undefined}>
              Curriculum
            </SectionLabel>
            {course.sections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
                {canManage
                  ? 'No sections yet. Add the first one to outline this program.'
                  : 'No sections yet.'}
              </p>
            ) : (
              <ol className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {course.sections.map((s) => (
                  <li key={s.id} className="flex items-start gap-4 px-5 py-3.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                      {s.order}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-800">{s.title}</span>
                      {s.description && (
                        <span className="mt-0.5 block text-sm text-neutral-500">{s.description}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Records — demoted to light links */}
          <section>
            <SectionLabel>Records</SectionLabel>
            <div className="flex flex-wrap gap-3">
              <RecordLink
                href={`/courses/${id}/sessions`}
                icon={PiClockCounterClockwise}
                label="Session history"
              />
              {isAdmin && (
                <RecordLink
                  href={`/courses/${id}/roster`}
                  icon={PiUsers}
                  label="Roster & certificates"
                />
              )}
            </div>
          </section>

          {/* Admin: invite-first management — a shareable link per role that
              lands people straight in this program. */}
          {isAdmin && (
            <CourseInviteManage
              courseId={id}
              currentInstructorName={course.instructor?.name ?? null}
              enrolledCount={course._count.enrollments}
              instructorInvites={courseInvites.filter((i) => i.role === 'INSTRUCTOR')}
              studentInvites={courseInvites.filter((i) => i.role === 'STUDENT')}
            />
          )}

          {isOwner && <InstructorPanel course={course} />}
        </div>

        {/* RAIL — the "program cockpit" */}
        <aside className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2">
          {/* Primary action / status */}
          {isOwner || isEnrolled ? (
            <JoinLiveCard
              courseId={id}
              canJoin={isOwner || isEnrolled}
              isInstructor={isOwner}
              joinableNow={sessionStatus.joinableNow}
              isLive={sessionStatus.isLive}
              nextAt={sessionStatus.nextAt}
              timezone={course.timezone}
              hasAssessment={hasAssessment}
            />
          ) : user?.role === 'STUDENT' ? (
            <div className={cn(cardClass, 'p-4')}>
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                Join this cohort
              </p>
              <p className="mb-3 mt-1.5 text-sm text-neutral-500">
                Enrol to join the live room, get reminders, and earn a certificate.
              </p>
              <EnrollActions courseId={id} isEnrolled={isEnrolled} />
            </div>
          ) : isAdmin ? (
            <ShadowJoinCard
              courseId={id}
              live={sessionStatus.isLive}
              joinableNow={sessionStatus.joinableNow}
            />
          ) : (
            <NextSessionCard live={sessionStatus.isLive} when={nextWhen} />
          )}

          {/* Cohort facts */}
          <FactsCard
            schedule={cadence}
            tz={tz}
            duration={duration}
            dates={dateRange}
            datesLabel={cohort.status === 'COMPLETED' ? 'Ran' : 'Dates'}
          />

          {/* Student reminder */}
          {isEnrolled && (
            <ClassReminderCard
              courseId={id}
              cadence={cadence}
              reminderAddedAt={myReminderAddedAt}
              scheduleUpdatedAt={course.scheduleUpdatedAt}
            />
          )}

          {/* Live-class leaderboard — shown to students, instructors & admins. */}
          <Leaderboard
            courseId={id}
            highlightUserId={user?.role === 'STUDENT' ? user.sub : undefined}
          />

          {/* Roster snapshot for admins */}
          {isAdmin && (
            <div className={cn(cardClass, 'p-4')}>
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                Roster
              </p>
              <p className="mt-1.5 text-[22px] font-extrabold tracking-tight text-neutral-950">
                {course._count.enrollments}{' '}
                <span className="text-sm font-semibold text-neutral-500">
                  {course._count.enrollments === 1 ? 'student' : 'students'}
                </span>
              </p>
              <Link
                href={`/courses/${id}/roster`}
                className="mt-2 inline-block text-[13px] font-bold text-signal-700 hover:text-signal-600"
              >
                View roster →
              </Link>
            </div>
          )}

          {/* Certificate held (student) */}
          {myCertificate && (
            <div className="flex items-start gap-3 rounded-2xl border border-signal-200 bg-signal-50 px-4 py-3.5 text-sm text-signal-800">
              <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
                <path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <p>
                You hold a certificate for this course (code{' '}
                <span className="font-mono">{myCertificate.verificationCode}</span>). Download it from your{' '}
                <Link href="/dashboard" className="font-medium underline">
                  dashboard
                </Link>
                .
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
