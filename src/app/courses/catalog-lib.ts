import type { BrowseSession, CatalogCourse } from '@/lib/types';

/**
 * A course is a time-boxed **cohort**: it runs on a weekly live cadence for a
 * fixed number of weeks and ends with a certificate. These helpers turn the raw
 * course/session data into the labels the catalog and detail pages render.
 *
 * All time math happens on the server (this module is imported by server
 * components; the client only receives the resolved strings) so there is no
 * `Date.now()` hydration drift.
 */

export type CohortStatus =
  | 'LIVE' // a session is running right now
  | 'IN_PROGRESS' // cohort started, not yet finished
  | 'STARTING_SOON' // starts within ~10 days
  | 'ENROLLING' // starts later — open to join
  | 'COMPLETED' // past its end date
  | 'OPEN'; // no schedule set yet

export interface ClassItem {
  courseId: string;
  title: string;
  monogram: string;
  instructor: string;
  instructorId: string | null; // owning instructor — powers the "Your programs" split
  category: string;
  level: string | null;
  enrollments: number;
  enrolled: boolean; // the viewing student is enrolled in this cohort

  isLive: boolean;
  liveSessionId: string | null;

  status: CohortStatus;
  statusLabel: string; // "Enrolling" · "In session" · "Week 3 of 8" · "Completed"
  statusHint: string | null; // secondary, e.g. "Starts Mon, Aug 4"

  scheduleLabel: string | null; // weekly cadence, e.g. "Mon & Wed · 6:00 PM"
  tzLabel: string | null; // "GMT+1"
  durationLabel: string | null; // "8 weeks"
  startText: string | null; // "Aug 4"

  startAtISO: string | null;
  nextText: string | null; // next scheduled session (absolute)
  nextRelText: string | null; // next scheduled session (relative)

  sessionCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* Fallback category inference for courses created before the field existed. */
const RULES: [string, RegExp][] = [
  ['Software Engineering', /system design|rust|kubernetes|typescript|\bd3\b|data vis|stream|\bapi\b|\bcode\b/i],
  ['Design', /figma|design system|\bdesign\b|\bux\b|\bui\b/i],
  ['Business', /financial|modeling|analytics|public speaking|product|market|finance|business/i],
  ['Music', /piano|jazz|music|guitar|vocal/i],
  ['Languages', /french|spanish|conversation|language|english|german/i],
  ['Art & Craft', /watercolor|ceramics|paint|drawing|\bart\b|pottery|sculpt/i],
];

export function categorize(title: string, description?: string | null): string {
  const hay = `${title} ${description ?? ''}`;
  for (const [label, re] of RULES) if (re.test(hay)) return label;
  return 'General';
}

export function monogram(title: string): string {
  const w = title.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return (title.trim().slice(0, 2) || '?').toUpperCase();
}

/* ---------- Schedule formatting ---------- */

/** "18:00" → "6:00 PM". */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

/** [1,3] + "18:00" → "Mon & Wed · 6:00 PM". */
export function formatCadence(
  days: number[] | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!days || days.length === 0) return time ? formatTime12(time) : null;
  const names = [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d] ?? '');
  const daysStr =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} & ${names[1]}`
        : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  return time ? `${daysStr} · ${formatTime12(time)}` : daysStr;
}

/** Short timezone label from an IANA zone (e.g. "GMT+1"); raw label otherwise. */
export function tzShort(tz: string | null | undefined, atISO?: string | null): string | null {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date(atISO || Date.now()));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz; // not a valid IANA zone → it's already a short label like "WAT"
  }
}

export function formatDuration(weeks: number | null | undefined): string | null {
  if (!weeks) return null;
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

/** "8 weeks (2 months)" when it divides evenly — for the detail page. */
export function formatDurationLong(weeks: number | null | undefined): string | null {
  if (!weeks) return null;
  const base = formatDuration(weeks)!;
  if (weeks % 4 === 0) {
    const mo = weeks / 4;
    return `${base} · ${mo} month${mo === 1 ? '' : 's'}`;
  }
  return base;
}

function fmtDate(iso: string, withWeekday = false): string {
  return new Date(iso).toLocaleDateString(undefined, {
    ...(withWeekday && { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
  });
}

/** start + duration → "Aug 4 – Sep 29". */
export function formatDateRange(startISO: string, weeks: number | null): string {
  const start = fmtDate(startISO);
  if (!weeks) return start;
  const end = new Date(new Date(startISO).getTime() + weeks * 7 * DAY_MS);
  return `${start} – ${fmtDate(end.toISOString())}`;
}

/** Absolute schedule label for one session, e.g. "Tue, Jul 29 · 2:00 PM". */
export function formatSchedule(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** Short relative hint for one session, e.g. "in 3h" / "tomorrow". */
export function relLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'starting soon';
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h}h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/* ---------- Cohort status ---------- */

export interface CohortState {
  status: CohortStatus;
  label: string;
  hint: string | null;
}

/** Where a cohort sits in its lifecycle, resolved against the server clock. */
export function deriveCohort(
  startISO: string | null,
  weeks: number | null,
  isLive: boolean,
): CohortState {
  if (isLive) return { status: 'LIVE', label: 'In session', hint: 'Live now' };
  if (!startISO) return { status: 'OPEN', label: 'Open to enroll', hint: null };

  const start = new Date(startISO).getTime();
  const now = Date.now();
  const end = weeks ? start + weeks * 7 * DAY_MS : null;

  if (now < start) {
    const days = Math.ceil((start - now) / DAY_MS);
    const on = `Starts ${fmtDate(startISO, true)}`;
    if (days <= 10) {
      const soon = days <= 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
      return { status: 'STARTING_SOON', label: soon, hint: on };
    }
    return { status: 'ENROLLING', label: 'Enrolling', hint: on };
  }

  if (end && now >= end) return { status: 'COMPLETED', label: 'Completed', hint: null };

  if (weeks) {
    const week = Math.min(weeks, Math.floor((now - start) / (7 * DAY_MS)) + 1);
    return { status: 'IN_PROGRESS', label: `Week ${week} of ${weeks}`, hint: 'In progress' };
  }
  return { status: 'IN_PROGRESS', label: 'In progress', hint: null };
}

/* ---------- Aggregation ---------- */

/**
 * Map the company-scoped catalog (GET /courses) into cohort cards.
 *
 * `enrolledCourseIds` are the ids the viewing student is enrolled in (from
 * GET /courses/enrolled). Omit for admins/instructors — every card is then
 * `enrolled: false`. Derived on the server so the flag ships resolved.
 */
export function coursesToClasses(
  courses: CatalogCourse[],
  enrolledCourseIds?: Iterable<string>,
): ClassItem[] {
  const enrolledSet = new Set(enrolledCourseIds ?? []);
  const out = courses.map((c) => {
    const isLive = Boolean(c.liveSessionId);
    const cohort = deriveCohort(c.startDate, c.durationWeeks, isLive);
    return {
      courseId: c.id,
      title: c.title,
      monogram: monogram(c.title),
      instructor: c.instructor?.name ?? 'Instructor to be assigned',
      instructorId: c.instructor?.id ?? c.instructorId ?? null,
      category: c.category ?? categorize(c.title, c.description),
      level: c.level ?? null,
      enrollments: c._count.enrollments,
      enrolled: enrolledSet.has(c.id),

      isLive,
      liveSessionId: c.liveSessionId,

      status: cohort.status,
      statusLabel: cohort.label,
      statusHint: cohort.hint,

      scheduleLabel: formatCadence(c.meetingDays, c.meetingTime),
      tzLabel: tzShort(c.timezone, c.startDate),
      durationLabel: formatDuration(c.durationWeeks),
      startText: c.startDate ? fmtDate(c.startDate) : null,

      startAtISO: c.startDate,
      nextText: c.nextSessionAt ? formatSchedule(c.nextSessionAt) : null,
      nextRelText: c.nextSessionAt ? relLabel(c.nextSessionAt) : null,

      sessionCount: (c.liveSessionId ? 1 : 0) + (c.nextSessionAt ? 1 : 0),
    } satisfies ClassItem;
  });
  return sortClasses(out);
}

/** Live first, then in-progress, starting-soon, enrolling, open, completed. */
function sortClasses(items: ClassItem[]): ClassItem[] {
  const RANK: Record<CohortStatus, number> = {
    LIVE: 0,
    IN_PROGRESS: 1,
    STARTING_SOON: 2,
    ENROLLING: 3,
    OPEN: 4,
    COMPLETED: 5,
  };
  return items.sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    const at = a.startAtISO ? +new Date(a.startAtISO) : Infinity;
    const bt = b.startAtISO ? +new Date(b.startAtISO) : Infinity;
    if (at !== bt) return at - bt;
    return a.title.localeCompare(b.title);
  });
}

/** Group the raw session feed into one row per cohort/class. */
export function toClasses(sessions: BrowseSession[]): ClassItem[] {
  const byCourse = new Map<string, BrowseSession[]>();
  for (const s of sessions) {
    const arr = byCourse.get(s.courseId);
    if (arr) arr.push(s);
    else byCourse.set(s.courseId, [s]);
  }

  const out: ClassItem[] = [];
  for (const [courseId, ss] of byCourse) {
    const c = ss[0].course;
    const liveS = ss.find((s) => s.status === 'LIVE') ?? null;
    const upcoming = ss
      .filter((s) => s.status === 'SCHEDULED')
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    const next = upcoming[0] ?? null;

    const isLive = Boolean(liveS);
    const startISO = c.startDate ?? null;
    const weeks = c.durationWeeks ?? null;
    const cohort = deriveCohort(startISO, weeks, isLive);

    out.push({
      courseId,
      title: c.title,
      monogram: monogram(c.title),
      instructor: c.instructor.name,
      instructorId: c.instructor.id ?? null,
      category: c.category ?? categorize(c.title, c.description),
      level: c.level ?? null,
      enrollments: c._count.enrollments,
      enrolled: false,

      isLive,
      liveSessionId: liveS?.id ?? null,

      status: cohort.status,
      statusLabel: cohort.label,
      statusHint: cohort.hint,

      scheduleLabel: formatCadence(c.meetingDays, c.meetingTime),
      tzLabel: tzShort(c.timezone, startISO),
      durationLabel: formatDuration(weeks),
      startText: startISO ? fmtDate(startISO) : null,

      startAtISO: startISO,
      nextText: next ? formatSchedule(next.scheduledAt) : null,
      nextRelText: next ? relLabel(next.scheduledAt) : null,

      sessionCount: ss.length,
    });
  }

  return sortClasses(out);
}
