import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';
import { ChangePasswordForm } from '../change-password-form';

export const metadata = { title: 'Password — livetich' };

export default async function PasswordPage() {
  if (!(await getCurrentUser())) redirect('/login');
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
          Password
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Use at least 8 characters. You&apos;ll stay signed in after changing it.
        </p>
        <div className={cn(cardClass, 'mt-6 p-5 sm:p-6')}>
          <ChangePasswordForm />
        </div>
      </main>
    </>
  );
}
