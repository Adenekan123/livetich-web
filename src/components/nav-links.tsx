'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui';

/** Primary nav with an active-route indicator (needs the client pathname). */
export function NavLinks({ showDashboard }: { showDashboard: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: '/courses', label: 'Programs' },
    ...(showDashboard
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/account', label: 'Settings' },
        ]
      : []),
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
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              active
                ? 'bg-neutral-100 text-neutral-950'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
