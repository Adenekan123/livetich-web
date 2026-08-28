'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiBooksBold,
  PiCertificateBold,
  PiChalkboardTeacherBold,
  PiGearBold,
  PiListBold,
  PiMagnifyingGlassBold,
  PiPuzzlePieceBold,
  PiShieldCheckBold,
  PiSignOutBold,
  PiSquaresFourBold,
  PiStudentBold,
  PiXBold,
} from 'react-icons/pi';
import { logout } from '@/app/actions/auth';
import { avatarColor, cn, initials } from '@/lib/ui';
import { BrandLogo } from './brand-logo';
import { IdleLogout } from './idle-logout';

/*
 * Direction B app shell — a persistent dark sidebar for the dashboard + account
 * surfaces. Server data (user, org) arrives as plain props from DashboardShell;
 * the nav is built here (per role) so the icon components never cross the
 * server→client boundary. The active item is the longest href that prefixes the
 * current path, so "/account/students" lights Students, not Account.
 */

type NavItem = { href: string; label: string; icon: IconType; group?: string };

const NAV: Record<string, NavItem[]> = {
  ORG_ADMIN: [
    { href: '/dashboard', label: 'Dashboard', icon: PiSquaresFourBold },
    { href: '/courses', label: 'Programs', icon: PiBooksBold },
    { href: '/account/instructors', label: 'Instructors', icon: PiChalkboardTeacherBold },
    { href: '/account/students', label: 'Students', icon: PiStudentBold },
    { href: '/account/plugins', label: 'Plugins', icon: PiPuzzlePieceBold },
    { href: '/account', label: 'Account', icon: PiGearBold, group: 'Settings' },
  ],
  INSTRUCTOR: [
    { href: '/dashboard', label: 'Dashboard', icon: PiSquaresFourBold },
    { href: '/courses', label: 'My programs', icon: PiBooksBold },
    { href: '/account', label: 'Account', icon: PiGearBold, group: 'You' },
  ],
  STUDENT: [
    { href: '/dashboard', label: 'Dashboard', icon: PiSquaresFourBold },
    { href: '/courses', label: 'Browse catalog', icon: PiMagnifyingGlassBold },
    { href: '/certificates', label: 'Certificates', icon: PiCertificateBold },
    { href: '/account', label: 'Account', icon: PiGearBold, group: 'You' },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

export interface ShellUser {
  name: string;
  role: string;
  sub: string;
  isSuperAdmin?: boolean;
}
export interface ShellOrg {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export function ShellChrome({
  user,
  org,
  children,
}: {
  user: ShellUser;
  org: ShellOrg | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    ...(NAV[user.role] ?? NAV.STUDENT),
    ...(user.isSuperAdmin
      ? [
          {
            href: '/admin',
            label: 'Platform admin',
            icon: PiShieldCheckBold,
            group: 'Platform',
          },
        ]
      : []),
  ];
  const activeHref = useMemo(() => {
    const matches = items.filter(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
    );
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [pathname, items]);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-1 bg-gradient-to-b from-[#0c2622] to-[#0f2e2a] px-4 py-5">
      <div className="flex items-center justify-between px-2 pb-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[19px] font-bold tracking-tight text-white"
          onClick={onNavigate}
        >
          <BrandLogo onDark />
        </Link>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        )}
      </div>

      {org && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-2">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          ) : (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[14px] font-extrabold text-white"
              style={{ backgroundColor: org.primaryColor ?? '#0d9488' }}
              aria-hidden
            >
              {initials(org.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[16.5px] font-bold text-white">{org.name}</p>
            <p className="text-[12.5px] font-medium text-white/45">Workspace</p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.group && (
                <p className="px-3 pb-1 pt-3.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.14em] text-white/40">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[16.5px] font-semibold transition',
                  active
                    ? 'bg-lime-400/15 text-white ring-1 ring-inset ring-lime-400/25'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <Icon className="h-[20px] w-[20px] shrink-0 opacity-90" />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center gap-2.5 px-1">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white',
              avatarColor(user.sub),
            )}
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16.5px] font-bold leading-tight text-white">{user.name}</p>
            <p className="text-[12.5px] text-white/45">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              title="Log out"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <PiSignOutBold className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#f4f6f3]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 lg:block">
        {sidebar()}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[264px] max-w-[82%] shadow-2xl">
            {sidebar(() => setOpen(false))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <PiListBold className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
          <span
            className={cn(
              'ml-auto grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white',
              avatarColor(user.sub),
            )}
            aria-hidden
          >
            {initials(user.name)}
          </span>
        </div>

        {/* Each page brings its own <main> so existing app screens keep their
            width + padding; the shell only supplies the frame around them. */}
        {children}
      </div>

      <IdleLogout />
    </div>
  );
}
