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
        <div className="mt-6 space-y-1.5 text-sm text-neutral-500">
          <p>
            Starting your own classes?{' '}
            <Link
              href="/register"
              className="font-semibold text-signal-700 hover:text-signal-600"
            >
              Create a teaching space
            </Link>
          </p>
          <p className="text-neutral-400">
            Joining a class? Open the invite link from your instructor — no
            separate signup needed.
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
