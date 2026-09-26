import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { ShortcutPanel } from './shortcut-panel';

export const metadata = { title: 'Quick access — livetich' };

export default async function ShortcutPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;

  // Null when the student has never set one up, or has turned it off.
  const existing = await api<{ slug: string } | null>('/auth/quick-access', {
    token,
  }).catch(() => null);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
        Quick access
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        For getting into class fast on your own phone.
      </p>
      <div className="mt-6">
        <ShortcutPanel initialSlug={existing?.slug ?? null} />
      </div>
    </main>
  );
}
