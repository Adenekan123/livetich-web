import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, btn, initials } from '@/lib/ui';
import type { Organization } from '@/lib/types';
import { IdleLogout } from './idle-logout';
import { BrandLogo } from './brand-logo';
import { NavLinks } from './nav-links';

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
};

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  let org: Organization | null = null;
  if (user?.organizationId) {
    const token = await getToken();
    org = await api<Organization | null>('/organizations/me', {
      token,
    }).catch(() => null);
  }
  const brand = org?.primaryColor ?? undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg transition hover:opacity-80"
          >
            <BrandLogo />
          </Link>

          {org && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-neutral-300">/</span>
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logoUrl}
                  alt=""
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <span
                  className="grid h-6 w-6 place-items-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: brand ?? '#0a0a0a' }}
                  aria-hidden
                >
                  {initials(org.name)}
                </span>
              )}
              <span className="text-sm font-semibold text-neutral-800">
                {org.name}
              </span>
            </div>
          )}

          <div className="hidden sm:block">
            <NavLinks showDashboard={Boolean(user)} />
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 px-1 py-0.5 sm:flex">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                  user.sub,
                )}`}
                aria-hidden
              >
                {initials(user.name)}
              </span>
              <span className="text-sm font-medium text-neutral-700">
                {user.name}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  {ROLE_LABEL[user.role] ?? user.role.toLowerCase()}
                </span>
              </span>
            </div>
            <form action={logout}>
              <button className={btn('secondary', 'sm')}>Log out</button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className={btn('ghost', 'sm')}>
              Log in
            </Link>
            <Link href="/register" className={btn('primary', 'sm')}>
              Get started
            </Link>
          </div>
        )}
      </div>
      {user && <IdleLogout />}
    </header>
  );
}
