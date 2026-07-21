// Shapes returned by the livetich-api REST endpoints.

export type Role = 'INSTRUCTOR' | 'STUDENT';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';

/** JWT claims, as returned by GET /auth/me. */
export interface SessionUser {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; name: string; email: string; role: Role };
}

export interface Section {
  id: string;
  courseId: string;
  order: number;
  title: string;
}

export interface CourseListItem {
  id: string;
  instructorId: string;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string };
  _count: { enrollments: number; sections: number };
}

export interface CourseDetail {
  id: string;
  instructorId: string;
  title: string;
  description: string | null;
  createdAt: string;
  instructor: { id: string; name: string };
  sections: Section[];
  _count: { enrollments: number };
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
  };
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
