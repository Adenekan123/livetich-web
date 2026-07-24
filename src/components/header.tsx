import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { getCurrentUser } from '@/lib/auth';
import { avatarColor, btn, initials } from '@/lib/ui';
import { Logo } from './logo';
import { NavLinks } from './nav-links';

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg transition hover:opacity-80"
          >
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              livetich
            </span>
          </Link>
          <div className="hidden sm:block">
            <NavLinks showDashboard={Boolean(user)} />
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                  user.sub,
                )}`}
                aria-hidden
              >
                {initials(user.name)}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {user.name}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {user.role.toLowerCase()}
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
    </header>
  );
}
