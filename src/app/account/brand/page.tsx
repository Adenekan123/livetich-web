import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';
import type { Organization } from '@/lib/types';
import { BrandKitForm } from '../brand-kit-form';

export const metadata = { title: 'Brand kit — livetich' };

export default async function BrandPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');
  const token = (await getToken())!;
  const org = await api<Organization | null>('/organizations/me', { token }).catch(
    () => null,
  );

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
          Brand kit
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          How your workspace appears to your instructors and students.
        </p>
        <div className={cn(cardClass, 'mt-6 p-5 sm:p-6')}>
          {org ? (
            <BrandKitForm org={org} />
          ) : (
            <p className="text-sm text-neutral-500">Organization not found.</p>
          )}
        </div>
      </main>
    </>
  );
}
