import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { Organization } from '@/lib/types';

export const metadata = { title: 'Profile — livetich' };

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;

  let org: Organization | null = null;
  if (user.organizationId) {
    org = await api<Organization | null>('/organizations/me', { token }).catch(() => null);
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
          Profile
        </h1>

        <div className={cn(cardClass, 'mt-6 p-5 sm:p-6')}>
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-semibold text-white',
                avatarColor(user.sub),
              )}
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-950">{user.name}</p>
              <p className="truncate text-sm text-neutral-500">{user.email}</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Role
              </dt>
              <dd className="mt-1 text-sm font-medium text-neutral-800">
                {ROLE_LABEL[user.role] ?? user.role}
              </dd>
            </div>
            {org && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Organization
                </dt>
                <dd className="mt-1 text-sm font-medium text-neutral-800">{org.name}</dd>
              </div>
            )}
          </dl>
        </div>
      </main>
    </>
  );
}
