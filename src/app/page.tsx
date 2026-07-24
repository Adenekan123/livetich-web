import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import {
  ArrowRight,
  Broadcast,
  Certificate,
  ChatCircleText,
  Check,
  Lightning,
  NotePencil,
  PenNib,
  SealCheck,
  Trophy,
} from '@/components/landing-icons';

/*
 * Radius scale (locked): interactive controls = rounded-full (pill),
 * containers/cards = rounded-2xl, small inner chips = rounded-xl.
 * Accent (locked): indigo-600. Dark surface (locked): #0a0e1f.
 */

type IconType = typeof Broadcast;

const FEATURES: {
  icon: IconType;
  title: string;
  body: string;
}[] = [
  {
    icon: PenNib,
    title: 'Shared chalkboard',
    body: 'A real-time whiteboard that syncs every stroke instantly. Instructors draw; the whole class follows along.',
  },
  {
    icon: ChatCircleText,
    title: 'Moderated live chat',
    body: 'A raise-hand queue, one-tap chat lock, and a random-pick button keep a big room focused and orderly.',
  },
  {
    icon: Lightning,
    title: 'Buzzer quizzes',
    body: 'Game-show rounds where the first correct answer wins, timed on the server so nobody can dispute who was first.',
  },
  {
    icon: Trophy,
    title: 'Live leaderboard',
    body: 'Points land the moment they are earned, and a public ranking turns every class into friendly competition.',
  },
];

const STEPS: { icon: IconType; title: string; body: string }[] = [
  {
    icon: NotePencil,
    title: 'Create your course',
    body: 'Set up sections, schedule a live session, and enroll your cohort in minutes.',
  },
  {
    icon: Broadcast,
    title: 'Go live and teach',
    body: 'Stream, draw on the board, run buzzer rounds, and pick raised hands, all in one room.',
  },
  {
    icon: SealCheck,
    title: 'Reward and certify',
    body: 'Points and the leaderboard keep students hooked; issue a certificate when they finish.',
  },
];

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <nav className="relative z-20 mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-semibold tracking-tight text-white">
          livetich
        </span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/courses"
          className="hidden rounded-full px-4 py-2 text-sm font-medium text-indigo-100/80 transition hover:bg-white/10 hover:text-white sm:block"
        >
          Browse courses
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:bg-indigo-500 active:scale-95"
          >
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-indigo-100/80 transition duration-200 ease-out hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:bg-indigo-500 active:scale-95"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

/* ------------------------------ page ------------------------------ */

export default async function Home() {
  return (
    <div className="flex flex-col">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden bg-[#0a0e1f] text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[130px]" />

        <LandingNav />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24 lg:pt-14">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-100">
              <span className="animate-live h-2 w-2 rounded-full bg-emerald-400" />
              Live and interactive, not another passive video library
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Teach skills <span className="text-indigo-300">live</span>, to a room
              that actually shows up.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-indigo-100/70">
              livetich puts a real classroom online: live video, a shared
              chalkboard, buzzer quizzes, a points leaderboard, and verifiable
              certificates. One room, built for cohorts of up to 500.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition duration-200 ease-out hover:bg-indigo-500 active:scale-[0.97]"
              >
                Get started
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/10 active:scale-[0.97]"
              >
                Browse courses
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-indigo-100/60">
              {['No downloads, runs in the browser', 'Up to 500 students per room'].map(
                (t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden /> {t}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Hero visual. TODO: replace the Picsum placeholder with a real
              product screenshot or a photo from a live session (1120x900). */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="overflow-hidden rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/10">
              <img
                src="https://picsum.photos/seed/livetich-live-class/1120/900"
                alt="An instructor leading a live online class"
                width={1120}
                height={900}
                loading="eager"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FEATURES (bento) ============================ */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              A whole classroom, not a stack of tools
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Stop stitching together a video call, a chat app, a quiz tool, and a
              slide deck. livetich is one place built for teaching live.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {/* Primary feature: split card with a real image */}
            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:col-span-2 sm:grid-cols-2">
              <div className="flex flex-col justify-center p-8">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white">
                  <Broadcast className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">
                  Live video classes
                </h3>
                <p className="mt-2 text-slate-600">
                  Low-latency WebRTC streaming for up to 500 students per room, with
                  no lag between a question and its answer. Instructors present;
                  students can be handed the mic to share their screen.
                </p>
              </div>
              {/* TODO: replace with a real classroom screenshot (900x760). */}
              <div className="relative min-h-[240px] bg-slate-100">
                <img
                  src="https://picsum.photos/seed/livetich-video-room/900/760"
                  alt="Students joining a live video class"
                  width={900}
                  height={760}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Supporting features: varied tints for background diversity */}
            {FEATURES.map(({ icon: Icon, title, body }, i) => {
              const tinted = i === 1 || i === 2;
              return (
                <div
                  key={title}
                  className={`group rounded-2xl border p-7 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-100 ${
                    tinted
                      ? 'border-indigo-100 bg-indigo-50/60 hover:border-indigo-200'
                      : 'border-slate-200 bg-white hover:border-indigo-200'
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {body}
                  </p>
                </div>
              );
            })}

            {/* Closing feature: full-width */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-7 sm:col-span-2 sm:flex-row sm:items-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
                <Certificate className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Verifiable certificates
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Finish a course and earn a QR-signed certificate anyone can verify
                  from a link. No logins, no forgeries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS (timeline) ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From empty room to full cohort
          </h2>
          <ol className="mt-12 space-y-10">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative flex gap-5 pb-2">
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute left-6 top-14 h-[calc(100%-2rem)] w-px bg-slate-200"
                    aria-hidden
                  />
                )}
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div className="pt-1.5">
                  <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-slate-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================ SPOTLIGHT ============================ */}
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Lightning className="h-3.5 w-3.5" aria-hidden /> Buzzer rounds
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Turn quiet lectures into a game show
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Open a question to everyone with a raised hand. The first correct
              answer wins the points and the right to ask the next question. Timing
              is decided on the server, so there is never an argument about who was
              first.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Server-authoritative timing, fair to the millisecond',
                'Live points that flow straight to the leaderboard',
                'One wrong guess locks you out of the round',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Illustrative buzzer card (real feature values, not a faked app shell) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-700">Buzzer round</p>
              <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" />
                0:12
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900">
              Which pattern forwards a stream once to many subscribers?
            </p>
            <div className="mt-5 grid gap-3">
              {[
                ['Mesh', false],
                ['SFU', true],
                ['MCU', false],
              ].map(([opt, correct]) => (
                <div
                  key={opt as string}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                    correct
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {opt}
                  {correct && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <Check className="h-4 w-4" aria-hidden /> Ada, plus 25
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="relative overflow-hidden rounded-2xl bg-[#0a0e1f] px-6 py-16 text-center shadow-2xl sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[700px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your next cohort is waiting for a better class
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100/70">
                Spin up a live room, invite your students, and teach the way the
                internet should have let you all along.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition duration-200 ease-out hover:bg-indigo-500 active:scale-[0.97]"
                >
                  Get started
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/10 active:scale-[0.97]"
                >
                  Browse courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-slate-900">
              livetich
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/courses" className="hover:text-slate-900">
              Browse courses
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Log in
            </Link>
            <Link href="/register" className="hover:text-slate-900">
              Get started
            </Link>
          </nav>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} livetich. Learn skills live.
          </p>
        </div>
      </footer>
    </div>
  );
}
