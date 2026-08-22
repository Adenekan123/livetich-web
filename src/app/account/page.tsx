import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiCaretRightBold,
  PiChalkboardTeacherBold,
  PiKeyBold,
  PiPaletteBold,
  PiPuzzlePieceBold,
  PiStudentBold,
  PiUserBold,
} from 'react-icons/pi';
import { getCurrentUser } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';

export const metadata = { title: 'Account — livetich' };

function SettingsRow({
  href,
  icon: Icon,
  title,
  subtitle,
  tone = 'soft',
}: {
  href: string;
  icon: IconType;
  title: string;
  subtitle: string;
  tone?: 'soft' | 'teal';
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
    >
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          tone === 'teal'
            ? 'bg-signal-700 text-white'
            : 'bg-signal-50 text-signal-700',
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-950">{title}</p>
        <p className="truncate text-sm text-neutral-500">{subtitle}</p>
      </div>
      <PiCaretRightBold className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500" />
    </Link>
  );
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.role === 'ORG_ADMIN';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-8">
        <h1 className="text-[22px] font-extrabold tracking-tight text-neutral-950">
          Account
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your account settings.</p>

        {/* Account */}
        <p className="mt-8 px-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">
          Account
        </p>
        <div className={cn(cardClass, 'mt-2 divide-y divide-neutral-100 overflow-hidden')}>
          <SettingsRow
            href="/account/profile"
            icon={PiUserBold}
            title="Profile"
            subtitle="Your name, email, role, and organization"
          />
          <SettingsRow
            href="/account/password"
            icon={PiKeyBold}
            title="Password"
            subtitle="Change your account password"
          />
          {isAdmin && (
            <SettingsRow
              href="/account/brand"
              icon={PiPaletteBold}
              title="Brand kit"
              subtitle="Your workspace name, logo, and colors"
            />
          )}
          {isAdmin && (
            <SettingsRow
              href="/account/add-ons"
              icon={PiPuzzlePieceBold}
              title="Add-ons"
              subtitle="Enable niche tool packs for your instructors"
            />
          )}
        </div>

        {isAdmin && (
          <>
            <p className="mt-8 px-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">
              People
            </p>
            <div className={cn(cardClass, 'mt-2 divide-y divide-neutral-100 overflow-hidden')}>
              <SettingsRow
                href="/account/instructors"
                icon={PiChalkboardTeacherBold}
                title="Manage instructors"
                subtitle="Invite teaching staff and assign programs"
                tone="teal"
              />
              <SettingsRow
                href="/account/students"
                icon={PiStudentBold}
                title="Manage students"
                subtitle="Invite students and track their performance"
                tone="teal"
              />
            </div>
          </>
        )}
    </main>
  );
}
