import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Sign up — livetich' };

export default async function RegisterPage() {
  if (await getCurrentUser().catch(() => null)) redirect('/dashboard');
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start teaching live classes or join one as a student."
      footer={
        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Log in
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
