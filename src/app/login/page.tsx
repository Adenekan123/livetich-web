import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata = { title: 'Log in - livetich' };

export default async function LoginPage() {
  if (await getCurrentUser().catch(() => null)) redirect('/dashboard');
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to run your class or join a live session."
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          New to livetich?{' '}
          <Link
            href="/register"
            className="font-semibold text-signal-700 hover:text-signal-600"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
