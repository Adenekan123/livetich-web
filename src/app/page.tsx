import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { HeroNetwork } from '@/components/hero-network';
import {
  ArrowRight,
  Broadcast,
  CalendarCheck,
  Certificate,
  ChatCircleText,
  Check,
  GraduationCap,
  Lightning,
  Monitor,
  NotePencil,
  PenNib,
  Trophy,
  UsersThree,
} from '@/components/landing-icons';

/*
 * DIRECTION — livetich landing (Persuade)
 * THESIS: One live room where a whole cohort connects to one instructor and
 *   competes in real time. Refuses the dark glowy-SaaS hero and the uniform
 *   icon-card feature grid.
 * OWN-WORLD: Pure white stage. Near-black Archivo display type, huge and tight.
 *   Fully monochrome — no chromatic accent. Emphasis comes from weight, scale,
 *   and motion (the near-black pulses that travel the network). Hairline rules,
 *   generous whitespace, editorial rows over boxed cards.
 * STORY: Visitor sees a living network of students orbiting one instructor with
 *   signals firing → understands it's a live, connected, competitive class →
 *   clicks Get started.
 * FIRST VIEWPORT: left — bold headline + subcopy + black CTA; right — the
 *   animated network, placed directly on the white ground, no frame.
 * FORM: editorial Swiss network diagram. Signature: traveling monochrome pulses.
 */

const TOOLS = [
  'Live video',
  'Shared chalkboard',
  'Buzzer quizzes',
  'Live leaderboard',
  'Moderated chat',
  'Verifiable certificates',
];

const FEATURES: {
  icon: typeof Broadcast;
  title: string;
  body: string;
}[] = [
  {
    icon: Broadcast,
    title: 'Live video, one room',
    body: 'Low-latency WebRTC streaming for a full cohort. Instructors present; students can be handed the mic to share their screen.',
  },
  {
    icon: PenNib,
    title: 'Shared chalkboard',
    body: 'A real-time board that syncs every stroke instantly. Instructors draw; the whole class follows along, live.',
  },
  {
    icon: ChatCircleText,
    title: 'Moderated chat',
    body: 'A raise-hand queue, one-tap lock, and a random-pick button keep a big room focused instead of chaotic.',
  },
  {
    icon: Trophy,
    title: 'Live leaderboard',
    body: 'Points land the instant they are earned. A public ranking turns every session into friendly competition.',
  },
];

const PROGRAM: {
  icon: typeof Broadcast;
  title: string;
  body: string;
}[] = [
  {
    icon: CalendarCheck,
    title: 'Cohort scheduling',
    body: 'Set a weekly cadence once. Sessions open automatically on the day — no manual go-live, everyone just joins.',
  },
  {
    icon: NotePencil,
    title: 'Assignments & grading',
    body: 'Post coursework, collect submissions, and grade with feedback — all tied to the program and the student.',
  },
  {
    icon: Certificate,
    title: 'Verifiable certificates',
    body: 'Issue a certificate the moment a student finishes. Each carries a QR code anyone can scan to verify.',
  },
  {
    icon: UsersThree,
    title: 'Teams & rosters',
    body: 'Invite instructors and students to your organization, assign programs, and manage every roster in one place.',
  },
  {
    icon: Monitor,
    title: 'Hand off the stage',
    body: 'Let a student talk and share their screen with one click, then take the room back just as fast.',
  },
  {
    icon: PenNib,
    title: 'Synced chalkboard',
    body: 'Switch the whole room to the board and back. Every stroke lands for every student in real time.',
  },
];

const USE_CASES: {
  icon: typeof Broadcast;
  title: string;
  body: string;
}[] = [
  {
    icon: Broadcast,
    title: 'Coding bootcamps',
    body: 'Run full-time and part-time cohorts live, with buzzer rounds that keep energy high.',
  },
  {
    icon: UsersThree,
    title: 'Corporate training',
    body: 'Onboard and upskill teams in your own org space, on a recurring cadence.',
  },
  {
    icon: GraduationCap,
    title: 'Academies & schools',
    body: 'Teach a class the way you would in a room — everyone present at the same time.',
  },
  {
    icon: ChatCircleText,
    title: 'Cohort communities',
    body: 'Turn a passive audience into a live cohort that shows up and competes together.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do students need to install anything?',
    a: 'No. livetich runs in the browser — students click one link and join the live room, video and board included.',
  },
  {
    q: 'How big can a cohort be?',
    a: 'It is built for whole cohorts in one room, not one-on-one calls. Everyone sees the same live session at once.',
  },
  {
    q: 'How does scheduling work?',
    a: 'Set a weekly cadence once. Sessions open automatically on the day — no manual go-live, everyone just joins.',
  },
  {
    q: 'Can students present too?',
    a: 'Yes. The instructor can hand any student the mic and screen share to speak, then take the room back with one click.',
  },
  {
    q: 'Are the certificates verifiable?',
    a: 'Every certificate carries a QR code and a code anyone can scan or enter to confirm it is genuine.',
  },
  {
    q: 'Is it built for organizations?',
    a: 'Yes — livetich is multi-tenant. Invite your instructors and staff into your own organization and manage every program in one place.',
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Create your course',
    body: 'Set up sections, schedule a live session, and enroll your cohort in minutes.',
  },
  {
    title: 'Go live and teach',
    body: 'Stream, draw on the board, run buzzer rounds, and pick raised hands — all in one room.',
  },
  {
    title: 'Reward and certify',
    body: 'Points and the leaderboard keep students hooked; issue a verifiable certificate when they finish.',
  },
];

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="sticky top-0 z-40 border-b border-neutral-200/60 bg-white/60 backdrop-blur-xl backdrop-saturate-150">
    <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-semibold tracking-tight text-neutral-950">
          livetich
        </span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/courses"
          className="hidden rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 sm:block"
        >
          Browse courses
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-full bg-signal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-signal-700/25 transition duration-200 ease-out hover:bg-neutral-800 active:scale-95"
          >
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-signal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-signal-700/25 transition duration-200 ease-out hover:bg-neutral-800 active:scale-95"
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default async function Home() {
  return (
    <div className="flex flex-col bg-white">
      <LandingNav />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-[1600px] items-center gap-8 px-5 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6 lg:pt-14">
          <div>
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700">
              <span className="animate-live h-2 w-2 rounded-full bg-signal-500" />
              For independent instructors — live, not pre-recorded
            </span>
            <h1 className="animate-fade-up mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] text-neutral-950 [animation-delay:60ms] sm:text-6xl lg:text-7xl">
              Teach your class{' '}
              <span className="underline decoration-[0.07em] underline-offset-[0.12em]">
                live
              </span>
              , to a room that shows up.
            </h1>
            <p className="animate-fade-up mt-6 max-w-md text-lg leading-relaxed text-neutral-600 [animation-delay:120ms]">
              Run your own live classes in one room — video, a shared chalkboard,
              quizzes, and a leaderboard. Built to keep working even on slow,
              low-data connections.
            </p>
            <div className="animate-fade-up mt-8 flex flex-col gap-3 [animation-delay:180ms] sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-signal-700/25 transition duration-200 ease-out hover:bg-neutral-800 active:scale-[0.97]"
              >
                Get started free
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition duration-200 ease-out hover:border-neutral-900 hover:text-neutral-950 active:scale-[0.97]"
              >
                Browse courses
              </Link>
            </div>
          </div>

          {/* The signature: an animated network, placed on the white ground. */}
          <div className="relative -mx-5 sm:mx-0">
            <HeroNetwork className="mx-auto h-auto w-full max-w-[620px]" />
          </div>
        </div>

        {/* one-room marquee */}
        <div className="relative border-y border-neutral-200 py-4">
          <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
              {[...TOOLS, ...TOOLS].map((t, i) => (
                <span
                  key={i}
                  className="flex shrink-0 items-center gap-8 text-sm font-medium tracking-tight text-neutral-500"
                >
                  {t}
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-500" aria-hidden />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-signal-600">
                One room, not a toolchain
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
                A whole classroom, not a stack of tools.
              </h2>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-neutral-600">
                Stop stitching together a video call, a chat app, a quiz tool,
                and a slide deck. livetich is one place built for teaching live.
              </p>
            </div>

            <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="group flex gap-5 py-7 transition-colors sm:gap-7"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-neutral-200 bg-white text-neutral-950 transition-colors duration-200 group-hover:border-neutral-950 group-hover:bg-neutral-950 group-hover:text-white">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-neutral-950">
                      {title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-neutral-600">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================ PROGRAM ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-signal-600">
              Beyond the live room
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              Everything it takes to run a cohort.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              The live class is the moment — but a program is more than a moment.
              livetich runs the schedule, the coursework, the roster, and the
              credential, so the whole thing lives in one place.
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAM.map(({ icon: Icon, title, body }) => (
              <div key={title} className="group">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-neutral-200 bg-white text-neutral-950 transition-colors duration-200 group-hover:border-neutral-950 group-hover:bg-neutral-950 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-neutral-950">
                  {title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ USE CASES (glass) ============================ */}
      <section className="relative overflow-hidden bg-neutral-950">
        {/* Soft tonal shapes behind the cards give the frosted glass something to
            blur — in a monochrome world the contrast, not colour, sells it. */}
        <div
          className="pointer-events-none absolute -left-16 top-24 h-80 w-80 rounded-full bg-white/[0.07] blur-[80px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-white/[0.05] blur-[90px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-neutral-400">
              Built for cohorts of every kind
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl">
              Wherever people learn together.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:bg-white/[0.12]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-md">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-white">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
            From empty room to full cohort.
          </h2>
          <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="relative">
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute left-16 top-7 hidden h-px w-[calc(100%-3rem)] bg-neutral-200 sm:block"
                    aria-hidden
                  />
                )}
                <span className="font-display text-5xl font-extrabold tracking-tight text-neutral-950">
                  {i + 1}
                  <span className="text-signal-500">.</span>
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-neutral-950">
                  {title}
                </h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================ BUZZER SPOTLIGHT ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700">
              <Lightning className="h-3.5 w-3.5" aria-hidden /> Buzzer rounds
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              Turn quiet lectures into a game show.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              Open a question to everyone with a raised hand. The first correct
              answer wins the points and the right to ask the next one. Timing is
              decided on the server, so there is never an argument about who was
              first.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Server-authoritative timing, fair to the millisecond',
                'Live points that flow straight to the leaderboard',
                'One wrong guess locks you out of the round',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-neutral-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal-500 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Authored buzzer card — real feature values, not a faked app shell. */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-950">
                Buzzer round
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-signal-50 px-2.5 py-1 text-xs font-semibold text-signal-700">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-signal-500" />
                0:12
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold tracking-tight text-neutral-950">
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
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${
                    correct
                      ? 'border-signal-500 bg-signal-50 text-neutral-950'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  {opt}
                  {correct && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-signal-700">
                      <Check className="h-4 w-4" aria-hidden /> Ada, +25
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOR INSTRUCTORS ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700">
              <UsersThree className="h-3.5 w-3.5" aria-hidden /> For every kind of instructor
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              Whatever you teach, run it live.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              livetich is built for independent instructors — Qur&apos;an and Arabic
              teachers, private tutors, coding instructors. Set up your own space,
              invite your students by link, and run recurring live classes on a
              schedule everyone actually shows up for.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Your own space — invite students with a simple link',
                'Recurring classes on a fixed weekly schedule',
                'Rosters, assignments, and completion tracked in one place',
                'Works even on slow, low-data connections',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-neutral-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal-500 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-signal-700/25 transition duration-200 ease-out hover:bg-neutral-800 active:scale-[0.97]"
              >
                Start teaching
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </div>

          {/* Advertising image — a real teaching moment, monochrome to hold the look. */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-900/5">
            <Image
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
              alt="An instructor teaching a live class"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover grayscale"
            />
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-signal-600">
                Good questions
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
                Answered.
              </h2>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-neutral-600">
                Everything worth knowing before your first live class.
              </p>
            </div>
            <dl className="divide-y divide-neutral-200 border-t border-neutral-200">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-6">
                  <dt className="text-lg font-bold tracking-tight text-neutral-950">
                    {q}
                  </dt>
                  <dd className="mt-2 leading-relaxed text-neutral-600">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-6 py-16 text-center sm:px-16 sm:py-20">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-signal-500/30 blur-[110px]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl">
                Your next cohort is waiting for a better class.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg text-neutral-300">
                Spin up a live room, invite your students, and teach the way the
                internet should have let you all along.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-signal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-signal-700/30 transition duration-200 ease-out hover:bg-neutral-800 active:scale-[0.97]"
                >
                  Get started free
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/10 active:scale-[0.97]"
                >
                  Browse courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-neutral-950">
              livetich
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
            <Link href="/courses" className="hover:text-neutral-950">
              Browse courses
            </Link>
            <Link href="/login" className="hover:text-neutral-950">
              Log in
            </Link>
            <Link href="/register" className="hover:text-neutral-950">
              Get started
            </Link>
            <Link href="/privacy" className="hover:text-neutral-950">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-neutral-950">
              Terms
            </Link>
          </nav>
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} livetich. Learn skills live.
          </p>
        </div>
      </footer>
    </div>
  );
}
