import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminNav } from './admin-nav';

export const metadata = { title: 'Platform admin — livetich' };

/**
 * Platform-operator console. Gated to super-admins (the API guard enforces this
 * independently on every /admin request; this is the UI-side gate). A distinct
 * top bar makes it unmistakable you're in the operator surface, not a tenant's.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isSuperAdmin) redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 items-center rounded-full bg-signal-700 px-3 text-xs font-bold uppercase tracking-wide text-white">
                Platform admin
              </span>
              <span className="hidden text-sm text-neutral-400 sm:inline">
                Operating Livetich across all organizations
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden text-neutral-500 sm:inline">{user.email}</span>
              <Link
                href="/dashboard"
                className="font-medium text-neutral-600 hover:text-signal-700"
              >
                ← Back to app
              </Link>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
