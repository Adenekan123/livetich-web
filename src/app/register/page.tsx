import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Sign up — livetich' };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <RegisterForm />
        <p className="mt-4 text-sm text-slate-600">
          Already registered?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </main>
    </>
  );
}
