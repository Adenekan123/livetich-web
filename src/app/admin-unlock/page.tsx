import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';
import { UnlockForm } from './unlock-form';

export const metadata = { title: 'Verify — Platform admin' };

/**
 * Step-up gate for the admin console. Lives OUTSIDE the /admin layout so it is
 * reachable without an existing step-up. Gated to super-admins; re-verifying the
 * password (re)issues the 30-minute step-up token the console requires.
 */
export default async function AdminUnlockPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isSuperAdmin) redirect('/dashboard');
  const { next } = await props.searchParams;
  const safeNext = next && next.startsWith('/admin') ? next : '/admin';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className={cn(cardClass, 'w-full max-w-sm p-8')}>
        <div className="mb-6">
          <span className="inline-flex h-7 items-center rounded-full bg-signal-700 px-3 text-xs font-bold uppercase tracking-wide text-white">
            Platform admin
          </span>
          <h1 className="mt-4 font-display text-xl font-extrabold text-neutral-950">
            Confirm your password
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            The operator console asks you to re-enter your password. This unlocks
            it for 30 minutes; the most sensitive actions re-check within 5.
          </p>
        </div>
        <UnlockForm next={safeNext} />
      </div>
    </div>
  );
}
