'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui';

/** Primary nav with an active-route indicator (needs the client pathname). */
export function NavLinks({ showDashboard }: { showDashboard: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: '/courses', label: 'Courses' },
    ...(showDashboard ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
  ];
  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
