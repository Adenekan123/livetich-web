// Shapes returned by the livetich-api REST endpoints.

export type Role = 'INSTRUCTOR' | 'STUDENT' | 'ORG_ADMIN';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';

/** JWT claims, as returned by GET /auth/me. */
export interface SessionUser {
  sub: string;
  role: Role;
  name: string;
  email: string;
  organizationId: string | null;
  emailVerified: boolean;
}

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    organizationId: string | null;
    emailVerified: boolean;
  };
}

/** An organization's public brand kit (GET /organizations/me, invite resolver). */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  tagline: string | null;
}

/** GET /invites/:token — resolves a join link for the register page. */
export interface InviteResolution {
  valid: boolean;
  role?: Exclude<Role, 'ORG_ADMIN'>;
  organization?: Organization;
}

export type InviteStatus = 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED';

/** An invite link as the org admin sees it. */
export interface OrgInvite {
  id: string;
  role: Role;
  token: string;
  label: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
  status: InviteStatus;
}

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
}

/** A student row with performance metrics (GET .../students/stats). */
export interface StudentStat {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  enrolledCourseIds: string[];
  points: number;
  interactions: number; // chat + quiz/buzzer answers
  attended: number; // live sessions joined
  held: number; // ENDED sessions in scope (attendance denominator)
  assignmentsSubmitted: number;
  assignmentsTotal: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  sectionId: string | null;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxPoints: number | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  fileUrl: string | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  student?: { id: string; name: string; email: string };
}

/** GET /courses/:id/assignments as a student — includes own submission. */
export interface StudentAssignment extends Assignment {
  mySubmission: Submission | null;
}

/** GET /courses/:id/assignments as instructor/admin — includes submission count. */
export interface ManagedAssignment extends Assignment {
  submissionCount: number;
}

export interface Section {
  id: string;
  courseId: string;
  order: number;
  title: string;
}

/**
 * Cohort-program fields shared by every course shape. A course is a time-boxed
 * cohort with a weekly live cadence and a certificate — not an on-demand video.
 * All optional: older courses (or drafts) may not have a schedule set yet.
 */
export interface CohortFields {
  category: string | null;
  level: string | null; // "Beginner" | "Intermediate" | "Advanced"
  startDate: string | null; // ISO — cohort's first day
  durationWeeks: number | null;
  meetingDays: number[] | null; // 0=Sun … 6=Sat
  meetingTime: string | null; // local 24h "HH:mm"
  timezone: string | null; // IANA zone or short label
}

export interface CourseListItem extends CohortFields {
  id: string;
  instructorId: string;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string };
  _count: { enrollments: number; sections: number };
}

export interface CourseDetail extends CohortFields {
  id: string;
  organizationId: string | null;
  instructorId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string } | null;
  sections: Section[];
  _count: { enrollments: number };
}

/** One row from the company-scoped catalog (GET /courses), with a session summary. */
export interface CatalogCourse extends CohortFields {
  id: string;
  organizationId: string | null;
  instructorId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string } | null;
  _count: { enrollments: number; sections: number };
  liveSessionId: string | null;
  nextSessionAt: string | null;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  createdAt: string;
  course: {
    id: string;
    instructorId: string;
    title: string;
    description: string | null;
    createdAt: string;
    instructor: { id: string; name: string };
  } & Partial<CohortFields>;
}

export interface LiveSession {
  id: string;
  courseId: string;
  sectionId: string | null;
  status: SessionStatus;
  livekitRoom: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

/** A live/upcoming session tile from GET /sessions/browse. */
export interface BrowseSession {
  id: string;
  courseId: string;
  sectionId: string | null;
  status: SessionStatus;
  scheduledAt: string;
  startedAt: string | null;
  section: { id: string; title: string; order: number } | null;
  course: {
    id: string;
    title: string;
    description: string | null;
    posterUrl?: string | null;
    instructor: { id: string; name: string };
    _count: { enrollments: number };
  } & Partial<CohortFields>;
}

export interface Certificate {
  id: string;
  courseId: string;
  studentId: string;
  verificationCode: string;
  pdfUrl: string | null;
  issuedById: string;
  issuedAt: string;
  course?: { id: string; title: string };
  student?: { id: string; name: string; email: string };
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  points: number;
  rank: number;
}
