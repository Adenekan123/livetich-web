import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { getCurrentUser } from '@/lib/auth';

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-indigo-600">
            livetich
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/courses" className="hover:text-slate-900">
              Courses
            </Link>
            {user && (
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-slate-500">
                {user.name}
                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-500">
                  {user.role.toLowerCase()}
                </span>
              </span>
              <form action={logout}>
                <button className="text-slate-500 hover:text-slate-900">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
