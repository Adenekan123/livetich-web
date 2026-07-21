import Link from 'next/link';
import { Header } from '@/components/header';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Learn skills <span className="text-indigo-600">live</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Interactive live classes with a chalkboard, chat, buzzer quizzes, a
          points leaderboard, and verifiable certificates.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/courses"
            className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
          >
            Browse courses
          </Link>
          {!user && (
            <Link
              href="/register"
              className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              Create an account
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
