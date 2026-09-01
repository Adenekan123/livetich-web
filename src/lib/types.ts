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
  isSuperAdmin: boolean; // platform operator — unlocks /admin
  impersonatedBy?: string; // present only while an operator is impersonating
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
  /** Set when the link is scoped to one program (join straight into it). */
  course?: { id: string; title: string } | null;
}

export type InviteStatus = 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED';

/** An invite link as the org admin sees it. */
export interface OrgInvite {
  id: string;
  role: Role;
  /** Set when the link is scoped to one program. */
  courseId: string | null;
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

/** A live session an assignment is tied to (summary form). */
export interface AssignmentSessionRef {
  id: string;
  scheduledAt: string;
  status: SessionStatus;
}

export interface Assignment {
  id: string;
  courseId: string;
  sectionId: string | null;
  sessionId: string | null; // set = tied to a live session
  groupId: string | null; // null = whole class; set = only this group
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxPoints: number | null;
  createdAt: string;
  group?: { id: string; name: string } | null; // target label, when grouped
  session?: AssignmentSessionRef | null; // tied session, when set
}

/** Minimal student identity used across roster/tracking. */
export interface StudentRef {
  id: string;
  name: string;
  email: string;
}

/** One submitted entry inside an assignment's tracking row. */
export interface TrackingSubmission {
  submissionId: string;
  student: StudentRef;
  content: string | null;
  /** Editor language id for code submissions (e.g. "python"); null otherwise. */
  language: string | null;
  fileUrl: string | null;
  fileMimeType: string | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
}

/** GET /courses/:id/assignments/tracking — one row per assignment with the
 *  target audience split into who submitted vs. who is still missing. */
export interface AssignmentTracking {
  id: string;
  courseId: string;
  sectionId: string | null;
  sessionId: string | null;
  groupId: string | null;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxPoints: number | null;
  createdAt: string;
  group: { id: string; name: string } | null;
  session: AssignmentSessionRef | null;
  audienceCount: number;
  submittedCount: number;
  gradedCount: number;
  submitted: TrackingSubmission[];
  missing: StudentRef[];
}

/** A student in a group's membership list. */
export interface GroupMember {
  id: string;
  groupId: string;
  studentId: string;
  student: { id: string; name: string; email: string };
}

/** A named subset of a course's students (GET /courses/:id/groups). */
export interface StudentGroup {
  id: string;
  courseId: string;
  name: string;
  createdAt: string;
  members: GroupMember[];
  _count: { members: number; assignments: number };
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  language: string | null;
  fileUrl: string | null;
  fileMimeType: string | null;
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

/** GET /assignments/mine — a student's coursework across every course. */
export interface MyAssignment {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  sessionId: string | null;
  sessionLive: boolean;
  dueAt: string | null;
  submitted: boolean;
}

export interface Section {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description: string | null;
}

// ---- Adaptive assessment (class-end quiz → remediation) ----

/** A bank MC question as the instructor authors it (includes the answer key). */
export interface AssessmentQuestion {
  id: string;
  courseId: string;
  sectionId: string;
  body: string;
  options: string[];
  correctIndex: number;
  active: boolean;
  createdAt: string;
}

/** A per-topic remediation task in the bank. */
export interface RemediationTask {
  id: string;
  courseId: string;
  sectionId: string;
  title: string;
  instructions: string | null;
  active: boolean;
  createdAt: string;
}

/** One row of GET /courses/:id/assessment/mine (student view). */
export interface AssessmentSummary {
  id: string;
  createdAt: string;
  topic: string | null;
  questionCount: number;
  attempt: { submittedAt: string | null; score: number | null; total: number | null } | null;
}

/** A single question presented to a student (answer key hidden until submitted). */
/** A materialised class-end quiz still held from students (manager view). */
export interface HeldAssessment {
  id: string;
  createdAt: string;
  endedAt: string | null;
  topic: string | null;
  questionCount: number;
}

export interface AssessmentTakeQuestion {
  id: string;
  body: string;
  options: string[];
  correctIndex?: number; // present only after submission
  myAnswerIndex?: number | null; // present only after submission
}

/** GET /assessments/:id — the quiz to take, or the graded result. */
export interface AssessmentTake {
  id: string;
  topic: string | null;
  submitted: boolean;
  score: number | null;
  total: number | null;
  questions: AssessmentTakeQuestion[];
}

/** POST /assessments/:id/submit result. */
export interface AssessmentResult {
  score: number;
  total: number;
  assignedRemediation: { id: string; title: string }[];
}

/** An uploaded course document used to ground AI drafting. */
export interface CourseDocument {
  id: string;
  filename: string;
  mimeType: string;
  charCount: number;
  createdAt: string;
}

/** POST /courses/:id/assessment/draft result — drafts to review, not yet saved. */
export interface DraftResult {
  sectionId: string;
  questions: { body: string; options: string[]; correctIndex: number }[];
  tasks: { title: string; instructions?: string }[];
}

/** A remediation task assigned to a student (GET /courses/:id/remediation/mine). */
export interface AssignedRemediation {
  id: string;
  status: 'PENDING' | 'DONE';
  sectionId: string;
  createdAt: string;
  completedAt: string | null;
  task: {
    id: string;
    title: string;
    instructions: string | null;
    section: { id: string; title: string };
  };
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
  /** Set when this course is a batch: the program it's an instance of. */
  parentCourseId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  scheduleUpdatedAt: string | null; // bumped on schedule change → reminder stale
  instructor: { id: string; name: string } | null;
  sections: Section[];
  _count: { enrollments: number };
}

/** A batch (scheduled instance) of a program, from GET /courses/:id/batches. */
export interface CourseBatch extends CohortFields {
  id: string;
  title: string;
  parentCourseId: string | null;
  instructor: { id: string; name: string } | null;
  _count: { enrollments: number };
  liveSessionId: string | null;
  nextSessionAt: string | null;
}

/** One row from the company-scoped catalog (GET /courses), with a session summary. */
export interface CatalogCourse extends CohortFields {
  id: string;
  organizationId: string | null;
  instructorId: string | null;
  /** Set when this row is a batch of a program (grouped/hidden in the catalog). */
  parentCourseId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string } | null;
  _count: { enrollments: number; sections: number };
  liveSessionId: string | null;
  nextSessionAt: string | null;
}

/** Org-wide class preferences (admin toggles). */
export interface OrgSettings {
  evictOnInstructorLeave: boolean;
  micRequiresRaisedHand: boolean;
  preClassReminder: boolean;
  reminderLeadMinutes: number;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  createdAt: string;
  reminderAddedAt: string | null; // last "Add to calendar" tap (reminder proxy)
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

/** A course's attendance sheet, filterable by session (GET /sessions/course/:id/attendance). */
export interface CourseAttendance {
  sessions: {
    id: string;
    scheduledAt: string;
    status: 'SCHEDULED' | 'LIVE' | 'ENDED';
    sectionTitle: string | null;
  }[];
  /** The session these rows describe — the requested one, or the latest by default. */
  sessionId: string | null;
  rows: {
    studentId: string;
    name: string;
    present: boolean;
    joinedAt: string | null;
  }[];
}

/** An add-on pack from the catalog, annotated with this org's enabled state. */
export interface PluginInfo {
  key: string;
  name: string;
  summary: string;
  features: string[];
  priceMonthly: number | null;
  enabled: boolean;
}

// ---- Qur'an / Hifz memorization ----------------------------------------

export type Revelation = 'Meccan' | 'Medinan';

/** One surah in the static catalog (GET /quran/surahs). */
export interface Surah {
  number: number;
  arabicName: string;
  transliteration: string;
  englishName: string;
  ayahCount: number;
  revelation: Revelation;
}

export type HifzKind = 'NEW_HIFZ' | 'REVISION';

/** A memorization goal set by the instructor for one student. */
export interface HifzTarget {
  id: string;
  courseId: string;
  studentId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  dueAt: string | null;
  note: string | null;
  createdAt: string;
}

/** One logged recitation — new memorization or revision (muraja'ah). */
export interface HifzEntry {
  id: string;
  courseId: string;
  studentId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  kind: HifzKind;
  rating: number | null;
  tajweed: string | null;
  notes: string | null;
  sessionId: string | null; // set = logged during this live session
  recordedAt: string;
}

/** Distinct-ayah progress summary derived from a student's NEW_HIFZ entries. */
export interface HifzProgress {
  ayahsMemorized: number;
  surahsTouched: number;
  lastRecitedAt: string | null;
}

/** One student's row in the instructor overview (GET /courses/:id/hifz). */
export interface HifzOverviewRow {
  student: { id: string; name: string; email: string };
  targets: HifzTarget[];
  entries: HifzEntry[];
  progress: HifzProgress;
}

/** A student's own view (GET /courses/:id/hifz/mine). */
export interface MyHifz {
  targets: HifzTarget[];
  entries: HifzEntry[];
  progress: HifzProgress;
}

// ---- Test Prep (exams) ----

export interface ExamQuestionInput {
  body: string;
  options: string[];
  correctIndex: number;
  topic?: string;
}

/** Manager list row. */
export interface ExamListRow {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  submissions: number;
  averageScore: number | null;
}

/** Student list row. */
export interface ExamAvailableRow {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  myAttempt: { id: string; score: number | null; submitted: boolean } | null;
}

/** Payload for an in-progress attempt (answers withheld). */
export interface ExamStart {
  attemptId: string;
  examId: string;
  title: string;
  durationMinutes: number;
  deadline: string;
  questions: { id: string; body: string; options: string[]; topic: string | null }[];
}

export interface ExamSubmitResult {
  score: number;
  correct: number;
  total: number;
  answered: number;
  /** True when the submit arrived after the deadline (scored 0). */
  expired?: boolean;
}

/** Full exam for the edit form. */
export interface ExamDetail {
  id: string;
  title: string;
  durationMinutes: number;
  /** Questions are frozen once anyone has attempted. */
  hasAttempts: boolean;
  questions: ExamQuestionInput[];
}

export interface ExamResults {
  examTitle: string;
  students: { studentId: string; name: string; score: number | null; submittedAt: string | null }[];
  topics: { topic: string; accuracy: number | null; answered: number }[];
}

/** A submitted attempt with the answer key + the student's picks, for review. */
export interface ExamReview {
  examTitle: string;
  score: number | null;
  total: number;
  submittedAt: string | null;
  questions: {
    id: string;
    body: string;
    options: string[];
    correctIndex: number;
    chosenIndex: number | null;
  }[];
}

/** Draft questions imported from ALOC for the builder. */
export interface AlocDraftResult {
  questions: ExamQuestionInput[];
  creditsRemaining: number | null;
  fromCache: boolean;
}

// ---- Platform admin console (GET /admin/*) ----

export interface AdminOverview {
  orgs: number;
  users: {
    total: number;
    active: number;
    disabled: number;
    instructors: number;
    students: number;
    admins: number;
  };
  courses: number;
  liveSessions: number;
  submissions30d: number;
  ai: {
    today: { calls: number; costUsd: number; tokens: number };
    last30d: { calls: number; costUsd: number; tokens: number };
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  organization: { id: string; name: string } | null;
}

export interface AdminUsersResult {
  total: number;
  page: number;
  pageSize: number;
  rows: AdminUserRow[];
}

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  users: number;
  courses: number;
}

export interface AuditLogRow {
  id: string;
  at: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  orgId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditResult {
  total: number;
  page: number;
  pageSize: number;
  rows: AuditLogRow[];
}

export interface AiUsageResult {
  range: { from: string; to: string };
  totals: {
    calls: number;
    costUsd: number;
    totalTokens: number;
    promptTokens: number;
    outputTokens: number;
  };
  byModel: { model: string; calls: number; costUsd: number; tokens: number }[];
  byFeature: { feature: string; calls: number; costUsd: number; tokens: number }[];
  byOrg: {
    orgId: string | null;
    orgName: string;
    calls: number;
    costUsd: number;
    tokens: number;
  }[];
  daily: { day: string; costUsd: number; tokens: number; calls: number }[];
}
