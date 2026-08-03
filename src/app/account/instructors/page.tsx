import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { CatalogCourse, OrgInvite, OrgMember } from '@/lib/types';
import { AssignProgramButton } from '../assign-program-button';
import { InviteLinkPanel } from '../invite-link-panel';
import { MemberStatusToggle } from '../member-status-toggle';
import { ProgramFilter } from '../program-filter';

export const metadata = { title: 'Manage instructors — livetich' };

export default async function ManageInstructorsPage(props: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');
  const token = (await getToken())!;
  const { courseId } = await props.searchParams;

  const [instructors, courses, invites] = await Promise.all([
    api<OrgMember[]>('/organizations/instructors', { token }),
    api<CatalogCourse[]>('/courses', { token }),
    api<OrgInvite[]>('/organizations/invites', { token }),
  ]);

  const programs = courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructorId: c.instructorId,
    instructorName: c.instructor?.name ?? null,
  }));
  const assignedOf = (id: string) => programs.filter((p) => p.instructorId === id);

  const rows = courseId
    ? instructors.filter((i) => assignedOf(i.id).some((p) => p.id === courseId))
    : instructors;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-950">
              Instructors
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {instructors.length} in your organization. Assign programs to the people
              who teach them.
            </p>
          </div>
          <ProgramFilter programs={programs} current={courseId} />
        </div>

        {/* Generate link */}
        <div className={cn(cardClass, 'mt-6 p-5')}>
          <h2 className="text-sm font-semibold text-neutral-900">Invite instructors</h2>
          <p className="mb-3 mt-0.5 text-xs text-neutral-500">
            Share a link to onboard teaching staff into your workspace.
          </p>
          <InviteLinkPanel
            role="INSTRUCTOR"
            invites={invites.filter((i) => i.role === 'INSTRUCTOR')}
          />
        </div>

        {/* Table */}
        <div className={cn(cardClass, 'mt-6 overflow-hidden')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <th className="px-5 py-3">Instructor</th>
                  <th className="px-5 py-3">Assigned programs</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-neutral-500">
                      No instructors match this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((i) => {
                    const assigned = assignedOf(i.id);
                    return (
                      <tr key={i.id} className="align-middle">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                                avatarColor(i.id),
                              )}
                              aria-hidden
                            >
                              {initials(i.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-medium text-neutral-900">
                                {i.name}
                                {i.status === 'DISABLED' && (
                                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                                    Disabled
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-neutral-400">{i.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {assigned.length === 0 ? (
                            <span className="text-xs text-neutral-400">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {assigned.map((p) => (
                                <span
                                  key={p.id}
                                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
                                >
                                  {p.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <AssignProgramButton
                              instructor={{ id: i.id, name: i.name }}
                              programs={programs}
                            />
                            <MemberStatusToggle memberId={i.id} status={i.status} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
