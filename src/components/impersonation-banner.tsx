import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE, stopImpersonating } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';

/**
 * App-wide banner shown only while a platform operator is impersonating another
 * user. Its presence is driven by the parked-token cookie; the button restores
 * the operator's own session. Renders nothing in the normal case.
 */
export async function ImpersonationBanner() {
  const jar = await cookies();
  if (!jar.get(ADMIN_TOKEN_COOKIE)) return null;

  const user = await getCurrentUser();

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>
        Viewing as{' '}
        <strong>{user ? `${user.name} (${user.email})` : 'another user'}</strong>{' '}
        — you are impersonating.
      </span>
      <form action={stopImpersonating}>
        <button
          type="submit"
          className="rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black"
        >
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
