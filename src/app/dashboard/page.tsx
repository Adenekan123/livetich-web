import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiBooks,
  PiCertificate,
  PiPlus,
  PiUsers,
} from 'react-icons/pi';
import { Header } from '@/components/header';
import { CourseCard } from '@/components/course-card';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type {
  CatalogCourse,
  Certificate,
  Enrollment,
  OrgMember,
} from '@/lib/types';
import {
  deriveCohort,
  formatCadence,
  formatDuration,
  type CohortState,
  type CohortStatus,
} from '../courses/catalog-lib';
import { CertificateDownload } from './certificate-download';

export const metadata = { title: 'Dashboard - livetich' };

/* Compact cohort badge for dashboard cards (monochrome). */
function CohortBadge({ status, label }: { status: CohortStatus; label: string }) {
  const styles: Record<CohortStatus, string> = {
    LIVE: 'bg-rose-100 text-rose-700',
    STARTING_SOON: 'bg-accent-100 text-accent-700',
    ENROLLING: 'bg-signal-100 text-signal-800',
    OPEN: 'border border-neutral-300 text-neutral-600',
    IN_PROGRESS: 'bg-signal-50 text-signal-800',
    COMPLETED: 'bg-neutral-100 text-neutral-400',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        styles[status],
      )}
    >
      {label}
    </span>
  );
}

/**
 * Instructors teach the program, so enrollment-facing states read wrong on
 * their cards: "Open to enroll" / "Enrolling" are for students browsing the
 * catalog. Show the schedule instead (or "Not scheduled" when there's none).
 */
function instructorCohortLabel(cohort: CohortState): string {
  if (cohort.status === 'OPEN') return 'Not scheduled';
  if (cohort.status === 'ENROLLING') return cohort.hint ?? 'Scheduled';
  return cohort.label;
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-neutral-950">
      {title}
      {count !== undefined && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
          {count}
        </span>
      )}
    </h2>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;

  const roleLabel =
    user.role === 'ORG_ADMIN'
      ? 'Manage your programs, instructors, and students.'
      : user.role === 'INSTRUCTOR'
        ? 'The programs you teach.'
        : 'Jump back into a class or enroll in a new one.';

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'grid h-12 w-12 place-items-center rounded-full text-base font-semibold text-white',
              avatarColor(user.sub),
            )}
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-neutral-500">{roleLabel}</p>
          </div>
        </div>

        {user.role === 'ORG_ADMIN' ? (
          <AdminConsole token={token} />
        ) : user.role === 'INSTRUCTOR' ? (
          <InstructorDashboard token={token} />
        ) : (
          <StudentDashboard token={token} />
        )}
      </main>
    </>
  );
}

/* ---------------- Org admin ---------------- */

function StatTile({
  label,
  value,
  href,
  live,
}: {
  label: string;
  value: number;
  href: string;
  live?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        'p-5 transition hover:border-neutral-300 hover:shadow-sm',
      )}
    >
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {live && (
          <span className="animate-live h-1.5 w-1.5 rounded-full bg-signal-500" />
        )}
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">
        {value}
      </dd>
    </Link>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: IconType;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        'flex items-start gap-4 p-5 transition hover:border-neutral-300 hover:shadow-sm',
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal-700 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-neutral-950">{title} →</p>
        <p className="mt-0.5 text-sm text-neutral-500">{desc}</p>
      </div>
    </Link>
  );
}

async function AdminConsole({ token }: { token: string }) {
  const [courses, instructors, students] = await Promise.all([
    api<CatalogCourse[]>('/courses', { token }),
    api<OrgMember[]>('/organizations/instructors', { token }),
    api<OrgMember[]>('/organizations/students', { token }),
  ]);

  const enrollments = courses.reduce((n, c) => n + c._count.enrollments, 0);
  const liveNow = courses.filter((c) => Boolean(c.liveSessionId)).length;

  return (
    <div className="mt-10 space-y-8">
      {/* Stats */}
      <div>
        <SectionHeading title="Overview" />
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Programs" value={courses.length} href="/courses" />
          <StatTile label="Live now" value={liveNow} href="/courses" live={liveNow > 0} />
          <StatTile label="Enrollments" value={enrollments} href="/courses" />
          <StatTile label="Instructors" value={instructors.length} href="/account" />
          <StatTile label="Students" value={students.length} href="/account" />
        </dl>
      </div>

      {/* Shortcuts */}
      <div>
        <SectionHeading title="Quick actions" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ShortcutCard
            icon={PiPlus}
            title="New program"
            desc="Create a cohort and set its weekly schedule."
            href="/courses"
          />
          <ShortcutCard
            icon={PiBooks}
            title="Programs"
            desc="Browse programs, assign instructors, manage rosters."
            href="/courses"
          />
          <ShortcutCard
            icon={PiUsers}
            title="People & brand"
            desc="Invite instructors and students, edit your brand."
            href="/account"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Instructor ---------------- */

async function InstructorDashboard({ token }: { token: string }) {
  const courses = await api<CatalogCourse[]>('/courses', { token });

  return (
    <div className="mt-10 space-y-10">
      <section>
        <SectionHeading title="Your programs" count={courses.length} />
        {courses.length === 0 ? (
          <EmptyState>
            No programs are assigned to you yet. Your company admin assigns the
            courses you&apos;ll teach.
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const cohort = deriveCohort(
                c.startDate,
                c.durationWeeks,
                Boolean(c.liveSessionId),
              );
              return (
                <CourseCard
                  key={c.id}
                  href={`/courses/${c.id}`}
                  title={c.title}
                  description={c.description}
                  badge={
                    <CohortBadge
                      status={cohort.status}
                      label={instructorCohortLabel(cohort)}
                    />
                  }
                  meta={[
                    formatCadence(c.meetingDays, c.meetingTime) ?? 'Schedule TBA',
                    formatDuration(c.durationWeeks) ?? '',
                    `${c._count.enrollments} students`,
                  ].filter((m): m is string => Boolean(m))}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Student ---------------- */

async function StudentDashboard({ token }: { token: string }) {
  const [enrollments, certificates] = await Promise.all([
    api<Enrollment[]>('/courses/enrolled', { token }),
    api<Certificate[]>('/certificates/mine', { token }),
  ]);
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <section>
        <div className="flex items-center justify-between">
          <SectionHeading title="Your programs" count={enrollments.length} />
          <Link
            href="/courses"
            className="text-sm font-semibold text-signal-700 hover:text-signal-600"
          >
            Browse catalog →
          </Link>
        </div>
        {enrollments.length === 0 ? (
          <EmptyState>
            You&apos;re not enrolled in anything yet.{' '}
            <Link
              href="/courses"
              className="font-semibold text-signal-700 hover:text-signal-600"
            >
              Browse your company&apos;s programs →
            </Link>
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4">
            {enrollments.map((e) => {
              const c = e.course;
              const cohort = deriveCohort(
                c.startDate ?? null,
                c.durationWeeks ?? null,
                false,
              );
              const cadence = formatCadence(c.meetingDays, c.meetingTime);
              return (
                <CourseCard
                  key={e.id}
                  href={`/courses/${e.courseId}`}
                  title={c.title}
                  badge={<CohortBadge status={cohort.status} label={cohort.label} />}
                  meta={[
                    `Taught by ${c.instructor?.name ?? 'TBA'}`,
                    cadence,
                    formatDuration(c.durationWeeks),
                  ].filter((m): m is string => Boolean(m))}
                />
              );
            })}
          </div>
        )}
      </section>
      <section>
        <SectionHeading title="Certificates" count={certificates.length} />
        {certificates.length === 0 ? (
          <EmptyState>
            None yet. Finish a program to earn a verifiable certificate.
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4">
            {certificates.map((c) => (
              <div key={c.id} className={cn(cardClass, 'p-5')}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-signal-700 text-white">
                    <PiCertificate className="h-5 w-5" />
                  </span>
                  <p className="font-semibold text-neutral-950">
                    {c.course?.title ?? 'Certificate'}
                  </p>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  Issued {new Date(c.issuedAt).toLocaleDateString()} · code{' '}
                  <span className="font-mono text-neutral-700">
                    {c.verificationCode}
                  </span>
                </p>
                <div className="mt-4 flex items-center gap-4 text-sm font-medium">
                  <CertificateDownload
                    certificateId={c.id}
                    ready={Boolean(c.pdfUrl)}
                  />
                  <a
                    className="text-neutral-500 hover:text-neutral-950"
                    href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/certificates/verify/${c.verificationCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Verify ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
