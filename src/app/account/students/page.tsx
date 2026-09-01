import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';
import type { CatalogCourse, OrgInvite, StudentStat } from '@/lib/types';
import { InviteLinkPanel } from '../invite-link-panel';
import { ManageStudentProgramsButton } from '../manage-student-programs-button';
import { MemberStatusToggle } from '../member-status-toggle';
import { ProgramFilter } from '../program-filter';
import { StudentPerformanceTable } from '../student-performance-table';

export const metadata = { title: 'Manage students — livetich' };

export default async function ManageStudentsPage(props: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');
  const token = (await getToken())!;
  const { courseId } = await props.searchParams;

  const [students, courses, invites] = await Promise.all([
    api<StudentStat[]>(
      `/organizations/students/stats${courseId ? `?courseId=${courseId}` : ''}`,
      { token },
    ),
    api<CatalogCourse[]>('/courses', { token }),
    // Workspace-level links only — program-scoped links live on the program page.
    api<OrgInvite[]>('/organizations/invites?courseId=', { token }),
  ]);

  const programs = courses.map((c) => ({ id: c.id, title: c.title }));

  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-950">
              Students
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {students.length}
              {courseId ? ' in this program' : ' in your organization'}. Performance
              {courseId ? ' is scoped to the selected program.' : ' is across all programs.'}
            </p>
          </div>
          <ProgramFilter programs={programs} current={courseId} />
        </div>

        {/* Generate link */}
        <div className={cn(cardClass, 'mt-6 p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">Invite students</h2>
          <p className="mb-3 mt-0.5 text-xs text-neutral-500">
            Share a link to let your students join this workspace and enroll.
          </p>
          <InviteLinkPanel
            role="STUDENT"
            invites={invites.filter((i) => i.role === 'STUDENT')}
          />
        </div>

        <StudentPerformanceTable
          students={students}
          scoped={Boolean(courseId)}
          showPrograms
          rowActions={Object.fromEntries(
            students.map((s) => [
              s.id,
              <div key={s.id} className="flex shrink-0 items-center justify-end gap-2">
                <ManageStudentProgramsButton
                  student={{ id: s.id, name: s.name }}
                  programs={programs}
                  enrolledCourseIds={s.enrolledCourseIds}
                />
                <MemberStatusToggle memberId={s.id} status={s.status} />
              </div>,
            ]),
          )}
        />
      </main>
    </>
  );
}
