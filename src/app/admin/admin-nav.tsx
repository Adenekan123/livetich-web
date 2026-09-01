'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/orgs', label: 'Organizations' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/ai-usage', label: 'AI usage' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active =
          t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition',
              active
                ? 'border-signal-600 text-signal-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
