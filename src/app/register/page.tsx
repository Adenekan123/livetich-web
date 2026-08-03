import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Create your company workspace — livetich' };

export default async function RegisterPage() {
  if (await getCurrentUser().catch(() => null)) redirect('/dashboard');
  return (
    <AuthShell
      title="Set up your company"
      subtitle="Create a workspace to run live cohort training for your students."
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-signal-700 hover:text-signal-600"
          >
            Log in
          </Link>
          <br />
          <span className="mt-1 inline-block text-neutral-400">
            Joining as a student or instructor? Use the invite link from your
            company.
          </span>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
