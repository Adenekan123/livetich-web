import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Create your teaching space — livetich' };

export default async function RegisterPage() {
  if (await getCurrentUser().catch(() => null)) redirect('/dashboard');
  return (
    <AuthShell
      title="Create your teaching space"
      subtitle="Set up livetich to run your own live classes — invite instructors and students once you're in."
      footer={
        <div className="mt-6 space-y-4">
          {/* Non-admins don't sign up here — they join with a link. Make that a
              clear, actionable callout instead of a greyed-out afterthought. */}
          <div className="rounded-xl border border-signal-200 bg-signal-50 px-4 py-3 text-sm text-signal-800">
            <p className="font-semibold">Joining a class as a student or instructor?</p>
            <p className="mt-1 text-signal-700">
              You don&apos;t sign up here — open the invite link your instructor
              or admin sent you and it&apos;ll take you straight in.
            </p>
          </div>
          <p className="text-sm text-neutral-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-signal-700 hover:text-signal-600"
            >
              Log in
            </Link>
          </p>
        </div>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
