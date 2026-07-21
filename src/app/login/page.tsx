import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata = { title: 'Log in — livetich' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
        <h1 className="text-2xl font-bold">Log in</h1>
        <LoginForm />
        <p className="mt-4 text-sm text-slate-600">
          No account?{' '}
          <Link href="/register" className="text-indigo-600 hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </>
  );
}
