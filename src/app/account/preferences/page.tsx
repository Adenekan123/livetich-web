import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';
import type { OrgSettings } from '@/lib/types';
import { PreferencesForm } from '../preferences-form';

export const metadata = { title: 'Class preferences — livetich' };

const FALLBACK: OrgSettings = {
  evictOnInstructorLeave: false,
  micRequiresRaisedHand: false,
  preClassReminder: false,
  reminderLeadMinutes: 30,
  inviteLinkExpiryDays: null,
};

export default async function PreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');
  const token = (await getToken())!;
  const settings = await api<OrgSettings | null>('/organizations/settings', {
    token,
  }).catch(() => null);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Account
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
        Class preferences
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        These rules apply to every live class run by your organization.
      </p>
      <div className={cn(cardClass, 'mt-6 p-5 sm:p-6')}>
        <PreferencesForm settings={settings ?? FALLBACK} />
      </div>
    </main>
  );
}
