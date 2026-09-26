import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { formatTime12 } from '@/app/courses/catalog-lib';
import type { Enrollment } from '@/lib/types';
import { PasscodeForm } from './passcode-form';
import { TodayScreen, type TodayClass } from './today-screen';

interface Shortcut {
  workspaceName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  organizationId: string;
}

/**
 * Does this program meet today, and at what time?
 *
 * Read from the program's cadence rather than from session rows. A LiveSession
 * only exists once somebody has walked into it — today's is materialised on
 * first entry — so a screen built on session rows shows an empty day right up
 * until the moment the class starts, which is exactly when it is least useful.
 * The cadence is what the timetable actually is.
 */
function meetsToday(c: Enrollment['course']): string | null {
  if (!c.meetingDays?.length || !c.meetingTime) return null;
  const now = new Date();
  const dow = now.getDay();
  if (!c.meetingDays.includes(dow)) return null;

  // Respect the cohort's own window: a program starting next month should not
  // appear on today's list just because it meets on a Tuesday.
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (c.startDate && new Date(c.startDate) > endOfToday) return null;
  if (c.startDate && c.durationWeeks) {
    const end = new Date(c.startDate);
    end.setDate(end.getDate() + c.durationWeeks * 7);
    if (end < startOfToday) return null;
  }

  // A per-day override wins over the program's general time.
  return c.meetingTimesByDay?.[String(dow)] ?? c.meetingTime;
}

/**
 * Today's classes: whatever is live first, then everything the timetable says
 * meets today, earliest first.
 *
 * A class can be live without being on today's timetable — an instructor can
 * start one any time — so live is taken from the session, and the rest from the
 * cadence, with the two deduplicated by program.
 */
function todaysClasses(enrollments: Enrollment[]): TodayClass[] {
  const live: TodayClass[] = [];
  const scheduled: { row: TodayClass; at: string }[] = [];

  for (const e of enrollments) {
    const c = e.course;
    // Null, never "Unassigned": a solo instructor running their own program
    // has no second name to show, and naming the gap tells a student about our
    // data model rather than about their class.
    const instructor = c.instructor?.name ?? null;
    if (c.liveSessionId) {
      live.push({ courseId: c.id, title: c.title, instructor, live: true, at: null });
      continue; // already accounted for; the cadence would only repeat it
    }
    const time = meetsToday(c);
    if (time) {
      scheduled.push({
        row: {
          courseId: c.id,
          title: c.title,
          instructor,
          live: false,
          at: formatTime12(time),
        },
        at: time, // "HH:mm" sorts correctly as a string
      });
    }
  }

  scheduled.sort((a, b) => a.at.localeCompare(b.at));
  return [...live, ...scheduled.map((s) => s.row)];
}

const WEEKDAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * When the next class is, for the days there is nothing on.
 *
 * An empty screen that only says "nothing today" is a dead end — the student
 * still has to go somewhere else to find out when to come back. Read from the
 * same cadence the day itself is read from, so the two can never disagree.
 */
function nextMeeting(enrollments: Enrollment[]): string | null {
  const today = new Date().getDay();
  let best: { delta: number; time: string; day: number } | null = null;
  for (const e of enrollments) {
    const c = e.course;
    if (!c.meetingDays?.length || !c.meetingTime) continue;
    for (const d of c.meetingDays) {
      // Strictly after today: today is already known to be empty.
      const delta = ((d - today + 7) % 7) || 7;
      const time = c.meetingTimesByDay?.[String(d)] ?? c.meetingTime;
      if (!best || delta < best.delta) best = { delta, time, day: d };
    }
  }
  if (!best) return null;
  const day = best.delta === 1 ? 'tomorrow' : `on ${WEEKDAY[best.day]}`;
  return `${day} at ${formatTime12(best.time)}`;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  try {
    const s = await api<Shortcut>(`/auth/quick-access/${slug}`);
    return {
      title: `${s.workspaceName} — join`,
      // Gives the home-screen icon its name and colour without the student
      // having to install anything.
      manifest: `/q/${slug}/manifest.webmanifest`,
      themeColor: s.primaryColor ?? undefined,
    };
  } catch {
    return { title: 'Join — livetich' };
  }
}

/**
 * What a student's home-screen shortcut opens.
 *
 * It shows the workspace and asks for six digits — never who the shortcut
 * belongs to. Anyone can open this URL, so it must reveal nothing about the
 * student until they have proved they are that student.
 */
export default async function QuickAccessPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  let shortcut: Shortcut;
  try {
    shortcut = await api<Shortcut>(`/auth/quick-access/${slug}`);
  } catch {
    notFound();
  }

  // Already signed in on this device: the shortcut's whole promise is one tap,
  // so show today rather than asking for the code again.
  //
  // Unless the session belongs to someone in another workspace — a shared
  // device, or a second account. Rendering this workspace's branding around
  // that person's classes would be wrong in both directions, so send them to
  // their own dashboard instead.
  const user = await getCurrentUser();
  if (user) {
    if (user.organizationId !== shortcut.organizationId) redirect('/dashboard');
    const token = (await getToken())!;
    const enrollments = await api<Enrollment[]>('/courses/enrolled', {
      token,
    }).catch(() => [] as Enrollment[]);
    const classes = todaysClasses(enrollments);
    return (
      <TodayScreen
        workspaceName={shortcut.workspaceName}
        logoUrl={shortcut.logoUrl}
        accent={shortcut.primaryColor ?? shortcut.accentColor}
        firstName={user.name.split(' ')[0]}
        classes={classes}
        nextUp={classes.length === 0 ? nextMeeting(enrollments) : null}
      />
    );
  }

  return (
    <AuthShell
      title={shortcut.workspaceName}
      subtitle="Enter your code to go straight to today's classes."
      footer={
        <p className="text-sm text-neutral-500">
          Forgotten it?{' '}
          <Link href="/login" className="font-semibold text-signal-600 hover:underline">
            Sign in with your email instead
          </Link>
          .
        </p>
      }
    >
      {shortcut.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shortcut.logoUrl}
          alt=""
          className="mx-auto mb-2 h-12 w-12 rounded-xl object-cover"
        />
      )}
      <PasscodeForm slug={slug} />
    </AuthShell>
  );
}
