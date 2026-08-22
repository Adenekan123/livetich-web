import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  PiArrowRightBold,
  PiCertificate,
  PiPlusBold,
  PiUsersBold,
} from 'react-icons/pi';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, btn, cn } from '@/lib/ui';
import type {
  CatalogCourse,
  Certificate,
  Enrollment,
  OrgMember,
} from '@/lib/types';
import {
  deriveCohort,
  formatCadence,
  formatTime12,
  monogram,
  relLabel,
  type CohortStatus,
} from '../courses/catalog-lib';
import { CertificateDownload } from './certificate-download';

export const metadata = { title: 'Dashboard - livetich' };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* --------------------------- honest derivations --------------------------- */

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function todayPill(): string {
  return new Date()
    .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Schedule progress for an in-flight cohort, derived on the server from the
 * start date + duration (calendar weeks elapsed, clamped). This is schedule
 * progress, not a mastery score — we only claim what the dates prove.
 */
function scheduleProgress(
  startISO: string | null | undefined,
  weeks: number | null | undefined,
): { pct: number; label: string } | null {
  if (!startISO || !weeks) return null;
  const start = new Date(startISO).getTime();
  const now = Date.now();
  if (now < start) return null;
  const week = Math.min(weeks, Math.floor((now - start) / (7 * DAY_MS)) + 1);
  const pct = Math.max(4, Math.min(100, Math.round((week / weeks) * 100)));
  return { pct, label: `Week ${week} of ${weeks}` };
}

type SessionKind = 'live' | 'next' | 'later';
interface SessionRow {
  id: string;
  title: string;
  instructor: string;
  time: string;
  kind: SessionKind;
}

/** Today's sessions, derived from the catalog payload's live + next-session
 *  fields. No new endpoint: a course is "live" if it has a live session id, and
 *  "today" if its next session lands on the current date. */
function todaysSessions(courses: CatalogCourse[]): SessionRow[] {
  const live: SessionRow[] = [];
  const scheduled: { row: SessionRow; at: number }[] = [];
  for (const c of courses) {
    const instructor = c.instructor?.name ?? 'Unassigned';
    if (c.liveSessionId) {
      live.push({ id: c.id, title: c.title, instructor, time: 'now', kind: 'live' });
    } else if (c.nextSessionAt && isToday(c.nextSessionAt)) {
      scheduled.push({
        row: { id: c.id, title: c.title, instructor, time: timeLabel(c.nextSessionAt), kind: 'later' },
        at: new Date(c.nextSessionAt).getTime(),
      });
    }
  }
  scheduled.sort((a, b) => a.at - b.at);
  const rows = scheduled.map((s, i) => ({ ...s.row, kind: i === 0 ? ('next' as const) : ('later' as const) }));
  return [...live, ...rows];
}

interface Banner {
  kind: 'live' | 'next';
  title: string;
  subtitle: string;
  href: string;
}

/** The one thing worth leading with: a live session, else the soonest upcoming
 *  one. Returns null when nothing is scheduled ahead. */
function pickBanner(courses: CatalogCourse[]): Banner | null {
  const live = courses.find((c) => c.liveSessionId);
  if (live) {
    return {
      kind: 'live',
      title: live.title,
      subtitle: `${live.instructor?.name ?? 'Your instructor'} is teaching now`,
      href: `/courses/${live.id}`,
    };
  }
  const upcoming = courses
    .filter((c) => c.nextSessionAt && new Date(c.nextSessionAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.nextSessionAt!).getTime() - new Date(b.nextSessionAt!).getTime())[0];
  if (upcoming?.nextSessionAt) {
    const today = isToday(upcoming.nextSessionAt);
    return {
      kind: 'next',
      title: upcoming.title,
      subtitle: `${today ? 'Today' : relLabel(upcoming.nextSessionAt)} at ${timeLabel(upcoming.nextSessionAt)}${upcoming.instructor ? ` · ${upcoming.instructor.name}` : ''}`,
      href: `/courses/${upcoming.id}`,
    };
  }
  return null;
}

/* ------------------------------- primitives ------------------------------- */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-neutral-200 bg-white p-4', className)}>
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  count,
  link,
}: {
  title: string;
  count?: number;
  link?: { label: string; href: string };
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-[18px] font-bold tracking-tight text-neutral-950">{title}</h3>
      {count !== undefined && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[14px] font-semibold text-neutral-500">
          {count}
        </span>
      )}
      {link && (
        <Link href={link.href} className="ml-auto text-[16px] font-bold text-signal-700 hover:text-signal-600">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  desc,
  href,
  teal,
}: {
  label: string;
  value: number | string;
  desc?: string;
  href: string;
  teal?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-2xl border p-4 transition',
        teal
          ? 'border-signal-100 bg-gradient-to-br from-signal-50 to-white hover:border-signal-200'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm',
      )}
    >
      <p className="font-mono text-[13.5px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={cn('mt-2 text-[36px] font-extrabold leading-none tracking-tight', teal ? 'text-signal-800' : 'text-neutral-950')}>
        {value}
      </p>
      {desc && <p className="mt-1.5 truncate text-[16px] font-medium text-neutral-500">{desc}</p>}
    </Link>
  );
}

function LiveBanner({ banner }: { banner: Banner }) {
  const live = banner.kind === 'live';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4',
        live
          ? 'border-lime-200 bg-gradient-to-r from-lime-50 to-white'
          : 'border-accent-100 bg-gradient-to-r from-accent-50 to-white',
      )}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-60" />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', live ? 'bg-lime-500' : 'bg-accent-600')} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-950">
          <span
            className={cn(
              'mr-2 rounded px-1.5 py-0.5 align-[1px] font-mono text-[13px] font-extrabold uppercase tracking-wider',
              live ? 'bg-lime-100 text-lime-700' : 'bg-accent-100 text-accent-700',
            )}
          >
            {live ? 'Live' : 'Next'}
          </span>
          {banner.title}
        </p>
        <p className="mt-1 text-[18px] text-neutral-500">{banner.subtitle}</p>
      </div>
      <Link href={banner.href} className={btn(live ? 'primary' : 'secondary', 'sm', 'shrink-0')}>
        {live ? 'Join session →' : 'View program →'}
      </Link>
    </div>
  );
}

function SchedulePanel({ rows }: { rows: SessionRow[] }) {
  const kindDot: Record<SessionKind, string> = {
    live: 'bg-lime-500',
    next: 'bg-accent-600',
    later: 'bg-neutral-300',
  };
  const kindPill: Record<SessionKind, string> = {
    live: 'bg-lime-100 text-lime-700',
    next: 'bg-accent-50 text-accent-700 border border-accent-100',
    later: 'bg-neutral-100 text-neutral-500',
  };
  const kindLabel: Record<SessionKind, string> = { live: 'Live', next: 'Next', later: 'Later' };
  return (
    <div className="divide-y divide-neutral-100">
      {rows.map((s) => (
        <Link
          key={`${s.id}-${s.time}`}
          href={`/courses/${s.id}`}
          className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span className="w-14 shrink-0 font-mono text-[16px] font-bold text-neutral-700">{s.time}</span>
          <span className={cn('h-9 w-[3px] shrink-0 rounded-full', kindDot[s.kind])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-neutral-950 group-hover:text-signal-700">{s.title}</p>
            <p className="truncate text-[16px] text-neutral-500">{s.instructor}</p>
          </div>
          <span className={cn('rounded-full px-2 py-0.5 font-mono text-[13.5px] font-bold uppercase tracking-wide', kindPill[s.kind])}>
            {kindLabel[s.kind]}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ProgramTile({
  href,
  title,
  subtitle,
  seed,
  ring,
  right,
}: {
  href: string;
  title: string;
  subtitle: string;
  seed: string;
  ring?: { pct: number } | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 transition hover:border-neutral-300 hover:bg-neutral-50/60">
      {ring ? (
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#84cc16 ${ring.pct}%, #eef2ee 0)` }}
          aria-hidden
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[13px] font-extrabold text-signal-800">
            {ring.pct}%
          </span>
        </span>
      ) : (
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[18px] font-extrabold tracking-tight text-white',
            avatarColor(seed),
          )}
          aria-hidden
        >
          {monogram(title)}
        </span>
      )}
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate text-[18px] font-bold tracking-tight text-neutral-950">{title}</p>
        <p className="truncate text-[16px] text-neutral-500">{subtitle}</p>
      </Link>
      {right}
    </div>
  );
}

/* status pill used inside program tiles */
function StatusPill({ status, label }: { status: CohortStatus; label: string }) {
  const styles: Record<CohortStatus, string> = {
    LIVE: 'bg-lime-100 text-lime-700',
    STARTING_SOON: 'bg-accent-50 text-accent-700 border border-accent-100',
    ENROLLING: 'bg-signal-50 text-signal-800',
    OPEN: 'bg-neutral-100 text-neutral-500',
    IN_PROGRESS: 'bg-signal-50 text-signal-800',
    COMPLETED: 'bg-neutral-100 text-neutral-400',
  };
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-[13.5px] font-bold uppercase tracking-wide', styles[status])}>
      {label}
    </span>
  );
}

/* --------------------------------- page ---------------------------------- */

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-8">
      {user.role === 'ORG_ADMIN' ? (
        <AdminConsole token={token} name={user.name} />
      ) : user.role === 'INSTRUCTOR' ? (
        <InstructorDashboard token={token} name={user.name} />
      ) : (
        <StudentDashboard token={token} name={user.name} />
      )}
    </main>
  );
}

function DashHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight text-neutral-950">{title}</h1>
        <p className="mt-1 text-[18px] text-neutral-500">{subtitle}</p>
      </div>
      <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[16px] font-bold text-neutral-500">
        {todayPill()}
      </span>
    </div>
  );
}

/* ---------------- Org admin ---------------- */

function FirstRunGuide({
  hasProgram,
  hasInstructors,
  hasStudents,
}: {
  hasProgram: boolean;
  hasInstructors: boolean;
  hasStudents: boolean;
}) {
  const steps = [
    {
      done: hasProgram,
      title: 'Create your first program',
      desc: 'Set a weekly schedule and how many weeks it runs. This is the class your students join live.',
      href: '/courses',
      cta: 'New program',
    },
    {
      done: hasInstructors,
      title: 'Invite your instructors',
      desc: 'Add anyone else who teaches. Skip this if it’s just you.',
      href: '/account',
      cta: 'Invite instructors',
    },
    {
      done: hasStudents,
      title: 'Invite your students',
      desc: 'Share a join link — they land straight in, no signup form.',
      href: '/account',
      cta: 'Invite students',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="max-w-2xl rounded-2xl border border-signal-100 bg-gradient-to-b from-signal-50 to-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-neutral-950">Get your first class running</h2>
          <p className="mt-1 text-[18px] text-neutral-600">A few steps and you’re teaching live.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[16px] font-semibold text-signal-700 ring-1 ring-signal-200">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center">
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] font-bold',
                s.done ? 'bg-signal-600 text-white' : 'bg-neutral-100 text-neutral-500',
              )}
              aria-hidden
            >
              {s.done ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path d="m5 10.5 3.2 3.2L15 6.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('font-semibold', s.done ? 'text-neutral-400 line-through' : 'text-neutral-950')}>{s.title}</p>
              {!s.done && <p className="mt-0.5 text-[18px] text-neutral-500">{s.desc}</p>}
            </div>
            {!s.done && (
              <Link href={s.href} className={btn(i === 0 ? 'primary' : 'secondary', 'sm', 'shrink-0')}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

async function AdminConsole({ token, name }: { token: string; name: string }) {
  const [courses, instructors, students] = await Promise.all([
    api<CatalogCourse[]>('/courses', { token }),
    api<OrgMember[]>('/organizations/instructors', { token }),
    api<OrgMember[]>('/organizations/students', { token }),
  ]);

  if (courses.length === 0) {
    return (
      <>
        <DashHead title={`${greeting()}, ${name.split(' ')[0]}`} subtitle="Let’s get your first class running." />
        <FirstRunGuide
          hasProgram={false}
          hasInstructors={instructors.length > 0}
          hasStudents={students.length > 0}
        />
      </>
    );
  }

  const enrollments = courses.reduce((n, c) => n + c._count.enrollments, 0);
  const liveCourses = courses.filter((c) => Boolean(c.liveSessionId));
  const enrolling = courses.filter((c) => {
    const s = deriveCohort(c.startDate, c.durationWeeks, Boolean(c.liveSessionId)).status;
    return s === 'ENROLLING' || s === 'STARTING_SOON';
  });
  const sessions = todaysSessions(courses);
  const banner = pickBanner(courses);

  return (
    <>
      <DashHead
        title={`${greeting()}, ${name.split(' ')[0]}`}
        subtitle={
          liveCourses.length > 0
            ? `${liveCourses.length} class${liveCourses.length === 1 ? '' : 'es'} live now · ${sessions.length} session${sessions.length === 1 ? '' : 's'} today`
            : `${sessions.length} session${sessions.length === 1 ? '' : 's'} scheduled today`
        }
      />
      <div className="space-y-4">
        {banner && <LiveBanner banner={banner} />}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <PanelHeader title="Today’s sessions" count={sessions.length} link={{ label: 'Programs', href: '/courses' }} />
              {sessions.length > 0 ? (
                <SchedulePanel rows={sessions} />
              ) : (
                <p className="py-6 text-center text-[18px] text-neutral-400">No sessions scheduled today.</p>
              )}
            </Card>
            {enrolling.length > 0 && (
              <Card>
                <PanelHeader title="Open for enrolment" count={enrolling.length} />
                <div className="space-y-2.5">
                  {enrolling.slice(0, 4).map((c) => {
                    const cohort = deriveCohort(c.startDate, c.durationWeeks, false);
                    return (
                      <ProgramTile
                        key={c.id}
                        href={`/courses/${c.id}`}
                        seed={c.id}
                        title={c.title}
                        subtitle={`${cohort.hint ?? cohort.label} · ${c._count.enrollments} enrolled`}
                        right={<StatusPill status={cohort.status} label={cohort.status === 'STARTING_SOON' ? 'Soon' : 'Enrolling'} />}
                      />
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Programs" value={courses.length} href="/courses" teal desc={enrolling.length > 0 ? `${enrolling.length} enrolling` : undefined} />
              <StatCard label="Enrollments" value={enrollments} href="/courses" desc={`across ${courses.length}`} />
              <StatCard label="Instructors" value={instructors.length} href="/account/instructors" />
              <StatCard label="Students" value={students.length} href="/account/students" />
            </div>
            <Card>
              <PanelHeader title="Quick actions" />
              <div className="space-y-2.5">
                <Link href="/courses" className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 transition hover:border-neutral-300 hover:bg-neutral-50/60">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal-700 text-white"><PiPlusBold className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[18px] font-bold text-neutral-950">New program</span><span className="block text-[16px] text-neutral-500">Create a cohort &amp; set its schedule</span></span>
                  <PiArrowRightBold className="h-4 w-4 text-neutral-300" />
                </Link>
                <Link href="/account" className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 transition hover:border-neutral-300 hover:bg-neutral-50/60">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal-800 text-white"><PiUsersBold className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[18px] font-bold text-neutral-950">Invite people</span><span className="block text-[16px] text-neutral-500">Instructors &amp; students</span></span>
                  <PiArrowRightBold className="h-4 w-4 text-neutral-300" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Instructor ---------------- */

async function InstructorDashboard({ token, name }: { token: string; name: string }) {
  const courses = await api<CatalogCourse[]>('/courses', { token });
  const banner = pickBanner(courses);
  const sessions = todaysSessions(courses);
  const students = courses.reduce((n, c) => n + c._count.enrollments, 0);
  const teachingToday = new Set(sessions.map((s) => s.id)).size;

  return (
    <>
      <DashHead title={`${greeting()}, ${name.split(' ')[0]}`} subtitle="The programs you teach." />
      {courses.length === 0 ? (
        <Card className="max-w-2xl border-dashed bg-neutral-50 text-center">
          <p className="py-6 text-[18px] text-neutral-500">
            No programs are assigned to you yet. Your company admin assigns the courses you&apos;ll teach.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {banner && <LiveBanner banner={banner} />}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <PanelHeader title="Your programs" count={courses.length} />
                <div className="space-y-2.5">
                  {courses.map((c) => {
                    const isLive = Boolean(c.liveSessionId);
                    const cohort = deriveCohort(c.startDate, c.durationWeeks, isLive);
                    const label = cohort.status === 'OPEN' ? 'Draft' : cohort.status === 'ENROLLING' ? 'Scheduled' : cohort.label;
                    return (
                      <ProgramTile
                        key={c.id}
                        href={`/courses/${c.id}`}
                        seed={c.id}
                        title={c.title}
                        subtitle={[
                          formatCadence(c.meetingDays, c.meetingTime) ?? 'Schedule TBA',
                          `${c._count.enrollments} students`,
                        ].join(' · ')}
                        right={
                          isLive ? (
                            <Link href={`/courses/${c.id}`} className={btn('primary', 'sm')}>Join →</Link>
                          ) : (
                            <StatusPill status={cohort.status} label={label} />
                          )
                        }
                      />
                    );
                  })}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Teaching today" value={teachingToday} href="/courses" teal desc={`of ${courses.length} programs`} />
                <StatCard label="Students" value={students} href="/courses" desc="across programs" />
              </div>
              <Card>
                <PanelHeader title="Today’s sessions" count={sessions.length} />
                {sessions.length > 0 ? (
                  <SchedulePanel rows={sessions} />
                ) : (
                  <p className="py-6 text-center text-[18px] text-neutral-400">Nothing scheduled today.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Student ---------------- */

interface NextClass {
  title: string;
  when: string;
}

/** Soonest upcoming enrolled class by weekly cadence. Presented as the class's
 *  own local meeting time (from meetingTime) + the nearest matching weekday — a
 *  schedule label, not an absolute countdown (which would need the class TZ). */
function nextClassFromCadence(enrollments: Enrollment[]): NextClass | null {
  const todayDow = new Date().getDay();
  let best: { title: string; day: number; delta: number; time: string } | null = null;
  for (const e of enrollments) {
    const c = e.course;
    if (!c.meetingDays?.length || !c.meetingTime) continue;
    for (const d of c.meetingDays) {
      const delta = (d - todayDow + 7) % 7;
      if (!best || delta < best.delta) best = { title: c.title, day: d, delta, time: c.meetingTime };
    }
  }
  if (!best) return null;
  const dayLabel = best.delta === 0 ? 'Today' : best.delta === 1 ? 'Tomorrow' : WEEKDAY[best.day];
  return { title: best.title, when: `${dayLabel} · ${formatTime12(best.time)}` };
}

async function StudentDashboard({ token, name }: { token: string; name: string }) {
  const [enrollments, certificates] = await Promise.all([
    api<Enrollment[]>('/courses/enrolled', { token }),
    api<Certificate[]>('/certificates/mine', { token }),
  ]);
  const next = nextClassFromCadence(enrollments);

  return (
    <>
      <DashHead
        title={`Welcome back, ${name.split(' ')[0]}`}
        subtitle={next ? `Your next class is ${next.when.toLowerCase()}` : 'Jump back into a class or enroll in a new one.'}
      />
      <div className="space-y-4">
        {next && (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-100 bg-gradient-to-r from-accent-50 to-white p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-neutral-950">
                <span className="mr-2 rounded bg-accent-100 px-1.5 py-0.5 align-[1px] font-mono text-[13px] font-extrabold uppercase tracking-wider text-accent-700">Next</span>
                {next.title}
              </p>
              <p className="mt-1 text-[18px] text-neutral-500">{next.when}</p>
            </div>
            <Link href="/courses" className={btn('secondary', 'sm', 'shrink-0')}>My classes →</Link>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <PanelHeader title="Continue learning" count={enrollments.length} link={{ label: 'Catalog', href: '/courses' }} />
              {enrollments.length === 0 ? (
                <p className="py-6 text-center text-[18px] text-neutral-500">
                  You&apos;re not enrolled in anything yet.{' '}
                  <Link href="/courses" className="font-semibold text-signal-700 hover:text-signal-600">Browse programs →</Link>
                </p>
              ) : (
                <div className="space-y-2.5">
                  {enrollments.map((e) => {
                    const c = e.course;
                    const cohort = deriveCohort(c.startDate ?? null, c.durationWeeks ?? null, false);
                    const progress =
                      cohort.status === 'IN_PROGRESS' ? scheduleProgress(c.startDate, c.durationWeeks) : null;
                    return (
                      <ProgramTile
                        key={e.id}
                        href={`/courses/${e.courseId}`}
                        seed={e.courseId}
                        title={c.title}
                        subtitle={[
                          progress?.label,
                          `Taught by ${c.instructor?.name ?? 'TBA'}`,
                        ].filter(Boolean).join(' · ')}
                        ring={progress ? { pct: progress.pct } : null}
                        right={<Link href={`/courses/${e.courseId}`} className={btn('secondary', 'sm')}>Open</Link>}
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Enrolled" value={enrollments.length} href="/courses" teal desc="active programs" />
              <StatCard label="Certificates" value={certificates.length} href="#certificates" desc="earned" />
            </div>
            <Card>
              <div id="certificates" />
              <PanelHeader title="Certificates" count={certificates.length} />
              {certificates.length === 0 ? (
                <p className="py-5 text-center text-[18px] text-neutral-500">None yet. Finish a program to earn a verifiable certificate.</p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {certificates.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-100 bg-gradient-to-br from-accent-100 to-white text-accent-700">
                        <PiCertificate className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[18px] font-bold text-neutral-950">{c.course?.title ?? 'Certificate'}</p>
                        <p className="truncate font-mono text-[14px] text-neutral-500">
                          {c.verificationCode} · {new Date(c.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <CertificateDownload certificateId={c.id} ready={Boolean(c.pdfUrl)} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
