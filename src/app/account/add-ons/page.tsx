import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { PluginInfo } from '@/lib/types';
import { AddOnsList } from './add-ons-list';

export const metadata = { title: 'Add-ons — livetich' };

export default async function AddOnsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');
  const token = (await getToken())!;
  const plugins = await api<PluginInfo[]>('/organizations/plugins', {
    token,
  }).catch(() => [] as PluginInfo[]);

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
          Add-ons
        </h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">
          Turn on packs of tools built for your teaching niche. Free during the
          pilot — turn them on and off any time.
        </p>
        <AddOnsList plugins={plugins} />
      </main>
    </>
  );
}
