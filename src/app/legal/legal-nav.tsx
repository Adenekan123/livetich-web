'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui';

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/dmca', label: 'DMCA' },
];

export function LegalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Legal documents navigation">
      {LEGAL_LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-150',
              active
                ? 'bg-signal-50 text-signal-700 font-semibold ring-1 ring-signal-300/70 shadow-xs'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
