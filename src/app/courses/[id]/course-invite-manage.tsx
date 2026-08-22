import { PiChalkboardTeacher, PiUsers } from 'react-icons/pi';
import { InviteLinkPanel } from '@/app/account/invite-link-panel';
import { cardClass, cn } from '@/lib/ui';
import type { OrgInvite } from '@/lib/types';

/**
 * Admin management for a program, invite-first: instead of assigning existing
 * members, generate a shareable link per role. Whoever opens it lands straight
 * in this program — a student is enrolled, an instructor is assigned to teach —
 * with no signup form. Links are scoped to this course (see the API's Invite
 * model + the register flow).
 */
export function CourseInviteManage({
  courseId,
  currentInstructorName,
  enrolledCount,
  instructorInvites,
  studentInvites,
}: {
  courseId: string;
  currentInstructorName: string | null;
  enrolledCount: number;
  instructorInvites: OrgInvite[];
  studentInvites: OrgInvite[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900">Manage program</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Share a link to bring people straight into this program — no signup form.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Instructor */}
        <div className={cn(cardClass, 'p-5')}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal-700 text-white">
              <PiChalkboardTeacher className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-neutral-900">Instructor</h3>
          </div>
          <p className="mt-3 text-sm text-neutral-500">
            {currentInstructorName ? (
              <>
                Currently teaching:{' '}
                <span className="font-medium text-neutral-800">{currentInstructorName}</span>
              </>
            ) : (
              'No instructor assigned yet.'
            )}
          </p>
          <p className="mb-3 mt-1 text-xs text-neutral-400">
            The person who opens this link is assigned to teach this program.
          </p>
          <InviteLinkPanel role="INSTRUCTOR" courseId={courseId} invites={instructorInvites} />
        </div>

        {/* Students */}
        <div className={cn(cardClass, 'p-5')}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal-700 text-white">
              <PiUsers className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-neutral-900">
              Students
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                {enrolledCount}
              </span>
            </h3>
          </div>
          <p className="mb-3 mt-3 text-xs text-neutral-400">
            Anyone who opens this link enrols in this program.
          </p>
          <InviteLinkPanel role="STUDENT" courseId={courseId} invites={studentInvites} />
        </div>
      </div>
    </section>
  );
}
