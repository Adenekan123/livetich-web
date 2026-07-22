import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

/* ------------------------------- icons ------------------------------- */

type IconProps = { className?: string };

const Broadcast = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const Pen = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4 20.5 4.7 17a2 2 0 0 1 .5-.9l9.8-9.8a2 2 0 0 1 2.8 0l.9.9a2 2 0 0 1 0 2.8l-9.8 9.8a2 2 0 0 1-.9.5L4 20.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const ChatLock = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <rect x="9.3" y="11" width="5.4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.3 11v-1a1.7 1.7 0 0 1 3.4 0v1" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const Bolt = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const Trophy = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M7 4h10v4a5 5 0 0 1-10 0V4Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M17 5h3v1a3 3 0 0 1-3 3M7 5H4v1a3 3 0 0 0 3 3M9.5 13.5 9 17h6l-.5-3.5M8 20h8M10 17v3M14 17v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Certificate = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="16.5" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="m15 19-.8 3 2.3-1.2L18.8 22 18 19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const Logo = ({ className }: IconProps) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect width="32" height="32" rx="9" fill="url(#lt-logo)" />
    <path d="M13 11.5v9l7.5-4.5L13 11.5Z" fill="white" />
    <defs>
      <linearGradient id="lt-logo" x1="0" y1="0" x2="32" y2="32">
        <stop stopColor="#818cf8" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
  </svg>
);

const Check = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ------------------------------ data ------------------------------ */

const FEATURES = [
  {
    icon: Broadcast,
    title: 'Live video classes',
    body: 'Low-latency WebRTC streaming for up to 500 students per room — no lag between a question and its answer.',
  },
  {
    icon: Pen,
    title: 'Shared chalkboard',
    body: 'A real-time whiteboard that syncs every stroke instantly. Instructors draw; the whole class follows along.',
  },
  {
    icon: ChatLock,
    title: 'Moderated live chat',
    body: 'Raise-hand queue, one-tap chat lock, and a random-pick button keep a big room focused and orderly.',
  },
  {
    icon: Bolt,
    title: 'Buzzer quizzes',
    body: 'Millionaire-style rounds where the first correct answer wins — server-timed to the millisecond, no disputes.',
  },
  {
    icon: Trophy,
    title: 'Live leaderboard',
    body: 'Points update the moment they are earned. A public ranking turns every class into friendly competition.',
  },
  {
    icon: Certificate,
    title: 'Verifiable certificates',
    body: 'Finish a course and get a QR-signed certificate anyone can verify — no logins, no forgeries.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Create your course',
    body: 'Set up sections, schedule a live session, and enroll your cohort in minutes.',
  },
  {
    n: '02',
    title: 'Go live & teach',
    body: 'Stream, draw on the board, run buzzer rounds, and pick raised hands — all in one room.',
  },
  {
    n: '03',
    title: 'Reward & certify',
    body: 'Points and the leaderboard keep students hooked; issue certificates when they finish.',
  },
];

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-semibold tracking-tight text-white">livetich</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/courses"
          className="hidden rounded-full px-4 py-2 text-sm font-medium text-indigo-100/80 transition hover:bg-white/10 hover:text-white sm:block"
        >
          Browse courses
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-950 shadow-sm transition duration-200 ease-out hover:bg-indigo-50 active:scale-95"
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
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-950 shadow-sm transition duration-200 ease-out hover:bg-indigo-50 active:scale-95"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

/* --------------------------- product mockup --------------------------- */

function ClassroomMockup() {
  return (
    <div className="relative">
      {/* floating accolades */}
      <div className="animate-float absolute -left-6 top-10 z-20 hidden rounded-xl border border-white/10 bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-base">🏆</span>
          <div>
            <p className="text-xs font-semibold text-slate-900">Ada won the buzzer</p>
            <p className="text-[11px] text-emerald-600">+25 points</p>
          </div>
        </div>
      </div>
      <div className="animate-float-slow absolute -right-5 bottom-16 z-20 hidden rounded-xl border border-white/10 bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
            <Certificate className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900">Certificate issued</p>
            <p className="text-[11px] text-slate-500">Verified · QR signed</p>
          </div>
        </div>
      </div>

      {/* app window */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-center text-[11px] text-slate-400">
            livetich.app/class/intro-to-live-streaming
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-[1.7fr_1fr]">
          {/* stage */}
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                <span className="animate-live h-2 w-2 rounded-full bg-rose-400" />
                LIVE
              </div>
              <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                🖐 3 hands
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 text-xl font-bold text-white backdrop-blur">
                  TI
                </div>
              </div>
              <div className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                🎙 Test Instructor
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['bg-sky-500', 'AD'],
                ['bg-teal-500', 'JO'],
                ['bg-amber-500', 'SM'],
              ].map(([c, initials]) => (
                <div
                  key={initials}
                  className={`relative aspect-video overflow-hidden rounded-lg ${c}`}
                >
                  <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/90">
                    {initials}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2">
              {['🎥', '🎙', '🖥', '✋'].map((e) => (
                <span
                  key={e}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm"
                >
                  {e}
                </span>
              ))}
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/90 text-sm">
                ⏻
              </span>
            </div>
          </div>

          {/* sidebar */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                <Trophy className="h-3.5 w-3.5" /> Leaderboard
              </p>
              <ul className="space-y-1.5 text-xs">
                {[
                  ['🥇', 'Ada', '145', 'text-amber-300'],
                  ['🥈', 'Jordan', '110', 'text-slate-300'],
                  ['🥉', 'Sam', '85', 'text-orange-300'],
                ].map(([m, name, pts, col]) => (
                  <li key={name} className="flex items-center justify-between text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <span>{m}</span> {name}
                    </span>
                    <span className={`font-mono font-semibold ${col}`}>{pts}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 rounded-xl bg-white/5 p-3">
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                Chat <span className="text-slate-500">🔒 locked</span>
              </p>
              <div className="space-y-2 text-[11px]">
                <p className="text-slate-300">
                  <span className="font-semibold text-indigo-300">Instructor:</span> Welcome
                  everyone! 👋
                </p>
                <p className="text-slate-300">
                  <span className="font-semibold text-slate-200">Ada:</span> Ready for the
                  buzzer round!
                </p>
                <p className="text-slate-400">
                  <span className="font-semibold text-slate-300">Jordan:</span> 🔥🔥
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default async function Home() {
  return (
    <div className="flex flex-col">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden bg-[#0a0e1f] text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-indigo-600/30 blur-[130px]" />
        <div className="pointer-events-none absolute -right-32 top-20 h-[520px] w-[520px] rounded-full bg-fuchsia-600/20 blur-[130px]" />

        <LandingNav />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-10 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-16">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-100">
              <span className="animate-live h-2 w-2 rounded-full bg-emerald-400" />
              Live, interactive teaching — not another video library
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Teach skills{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                live
              </span>
              , to a room that actually shows up.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-indigo-100/70">
              livetich brings a real classroom online: live video, a shared chalkboard,
              buzzer quizzes, a points leaderboard, and verifiable certificates — all in one
              room, built for cohorts of up to 500.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition duration-200 ease-out hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-900/60 active:scale-[0.97]"
              >
                Start teaching free
                <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/10 active:scale-[0.97]"
              >
                Explore live courses
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-indigo-100/60">
              {['No downloads', 'Up to 500 per room', 'Free to start'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-400" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <ClassroomMockup />
          </div>
        </div>

        {/* soft transition into the light section */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ============================ STATS ============================ */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-12 sm:grid-cols-4">
          {[
            ['500', 'Students per live room'],
            ['<200ms', 'Answer-to-buzz latency'],
            ['6', 'Tools in one room'],
            ['100%', 'Verifiable certificates'],
          ].map(([stat, label]) => (
            <div key={label} className="text-center sm:text-left">
              <p className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {stat}
              </p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Everything in one room
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              A whole classroom, not a stack of tools
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Stop stitching together a video call, a chat app, a quiz tool, and a slide deck.
              livetich is one place built for teaching live.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-3">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From empty room to full cohort in three steps
            </h2>
          </div>
          <div className="relative mt-14 grid gap-8 md:grid-cols-3">
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent md:block" />
            {STEPS.map((s) => (
              <div key={s.n} className="relative text-center md:text-left">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-lg md:mx-0">
                  {s.n}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ SPOTLIGHT ============================ */}
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Bolt className="h-3.5 w-3.5" /> Buzzer rounds
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Turn quiet lectures into a game show
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Open a question to everyone with a raised hand. The first correct answer wins
              the points and the right to ask the next question — timing is decided on the
              server, so there is never an argument about who was first.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Server-authoritative timing — millisecond fair',
                'Live points that flow straight to the leaderboard',
                'One wrong guess locks you out of the round',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* buzzer mock */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Buzzer round
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" /> 0:12
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
                      <Check className="h-4 w-4" /> Ada +25
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
          <div className="relative overflow-hidden rounded-3xl bg-[#0a0e1f] px-6 py-16 text-center shadow-2xl sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[700px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[120px]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your next cohort is waiting for a better class
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100/70">
                Spin up a live room, invite your students, and teach the way the internet
                should have let you all along.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-950 shadow-lg transition duration-200 ease-out hover:bg-indigo-50 active:scale-[0.97]"
                >
                  Create your first course
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
            <span className="font-semibold tracking-tight text-slate-900">livetich</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/courses" className="hover:text-slate-900">
              Courses
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
