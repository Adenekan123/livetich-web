import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { HeroNetwork } from '@/components/hero-network';
import { Reveal, Stagger, StaggerItem, CountUp, WordReveal } from '@/components/landing-motion';
import {
  ArrowRight,
  Broadcast,
  BookOpenText,
  Buildings,
  CalendarCheck,
  Certificate,
  ChatCircleText,
  Check,
  Code,
  Exam,
  GraduationCap,
  Lightning,
  Minus,
  NotePencil,
  PenNib,
  Quotes,
  Sparkle,
  Trophy,
  UsersThree,
  WifiHigh,
  X,
} from '@/components/landing-icons';

/*
 * DIRECTION — livetich landing (Persuade), v2 "warm & live"
 * THESIS: One live room where a whole cohort connects to one instructor and
 *   competes in real time — and one platform that adapts to what you teach.
 * SYSTEM: The product's teal (primary) + amber (accent) brand on white, with a
 *   dark teal "operations" band. Follows the ui-ux-pro-max Real-Time/Operations
 *   landing pattern: hero + live status, key metrics, comparison, how-it-works,
 *   CTA. Motion is scroll-revealed and reduced-motion-safe (see landing-motion).
 */

const TOOLS = [
  'Live video',
  'Shared chalkboard',
  'Buzzer quizzes',
  'Live leaderboard',
  'Moderated chat',
  'Verifiable certificates',
];

const FEATURES = [
  {
    icon: Broadcast,
    title: 'Live video, one room',
    body: 'Low-latency WebRTC for a full cohort. Instructors present; any student can be handed the mic and screen with one click.',
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

const PROGRAM = [
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
    icon: Buildings,
    title: 'Your own branded space',
    body: 'livetich is multi-tenant. Your organization gets its own space and brand colour — students see you, not us.',
  },
  {
    icon: WifiHigh,
    title: 'Built for slow networks',
    body: 'A data-saver mode keeps the class working on 2G and low-data connections — strokes over video when the pipe is thin.',
  },
];

const USE_CASES = [
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

/* Add-on packs — mirrored from the plugin catalog (islamic-education,
 * code-instruction, test-prep). Feature code gates on these. */
const PACKS = [
  {
    icon: BookOpenText,
    key: 'Core',
    name: 'The live classroom',
    tint: 'signal',
    tagline: 'Every account',
    features: [
      'Live video + shared chalkboard',
      'Buzzer quizzes & live leaderboard',
      'Raise-hand queue & moderated chat',
      'Scheduling, rosters & certificates',
    ],
  },
  {
    icon: Sparkle,
    key: 'islamic-education',
    name: 'Islamic education',
    tint: 'accent',
    tagline: 'Add-on pack',
    features: [
      'Hifz memorisation tracking',
      'Shared Uthmani Qur’an reader',
      'Live Hifz panel + audio review',
      'Tajwīd worksheets & feedback',
    ],
  },
  {
    icon: Code,
    key: 'code-instruction',
    name: 'Code instruction',
    tint: 'signal',
    tagline: 'Add-on pack',
    features: [
      'Shared in-room code editor',
      'Live code-submission review',
      'Language picker per exercise',
      'Run students’ code together, live',
    ],
  },
  {
    icon: Exam,
    key: 'test-prep',
    name: 'Test prep',
    tint: 'accent',
    tagline: 'Add-on pack',
    features: [
      'Exam manager & question bank',
      'Timed assessments with accuracy',
      'AI-assisted question drafting',
      'Study groups & cohorts',
    ],
  },
];

/* Comparison matrix — one live room vs. a stack of single-purpose tools.
 * yes = full, part = partial/clunky, no = not offered. */
type Cell = 'yes' | 'part' | 'no';
const COMPARE_COLS = ['Video app', 'Whiteboard', 'Quiz app', 'Classroom', 'Cert tool'];
const COMPARE_ROWS: { label: string; others: Cell[]; livetich: Cell }[] = [
  { label: 'Live video for a whole cohort', others: ['yes', 'no', 'no', 'part', 'no'], livetich: 'yes' },
  { label: 'Real-time shared chalkboard', others: ['part', 'yes', 'no', 'no', 'no'], livetich: 'yes' },
  { label: 'Buzzer quizzes with live points', others: ['no', 'no', 'yes', 'no', 'no'], livetich: 'yes' },
  { label: 'Live leaderboard', others: ['no', 'no', 'yes', 'no', 'no'], livetich: 'yes' },
  { label: 'Scheduling, rosters & grading', others: ['no', 'no', 'no', 'yes', 'no'], livetich: 'yes' },
  { label: 'Verifiable certificates', others: ['no', 'no', 'no', 'part', 'yes'], livetich: 'yes' },
  { label: 'Works on 2G / data-saver', others: ['no', 'part', 'part', 'part', 'part'], livetich: 'yes' },
  { label: 'Everyone in one room', others: ['no', 'no', 'no', 'no', 'no'], livetich: 'yes' },
];

const FAQ = [
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
    q: 'What are add-on packs?',
    a: 'Beyond the core live classroom, packs add tools for what you teach: Qur’an & Hifz, live coding, or timed exams. Turn on only what you need.',
  },
  {
    q: 'Are the certificates verifiable?',
    a: 'Every certificate carries a QR code and a code anyone can scan or enter to confirm it is genuine.',
  },
  {
    q: 'Is it built for organizations?',
    a: 'Yes — livetich is multi-tenant. Invite your instructors and staff into your own branded organization and manage every program in one place.',
  },
];

const STEPS = [
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

/* ------------------------------ small parts ------------------------------ */

/** Comparison-table cell mark. Not colour-only: each state has its own glyph. */
function Mark({ v }: { v: Cell }) {
  if (v === 'yes')
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-signal-100 text-signal-700">
        <Check className="h-4 w-4" weight="bold" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  if (v === 'part')
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-accent-100 text-accent-700">
        <Minus className="h-4 w-4" weight="bold" aria-hidden />
        <span className="sr-only">Partial</span>
      </span>
    );
  return (
    <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-neutral-100 text-neutral-400">
      <X className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="sticky top-0 z-40 border-b border-neutral-200/60 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight text-neutral-950">
            livetich
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="#features"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-signal-50 hover:text-signal-700 md:block"
          >
            Features
          </Link>
          <Link
            href="#compare"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-signal-50 hover:text-signal-700 md:block"
          >
            Compare
          </Link>
          <Link
            href="/courses"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-signal-50 hover:text-signal-700 sm:block"
          >
            Browse courses
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-signal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-signal-800/25 transition duration-200 ease-out hover:bg-signal-800 active:scale-95"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-signal-50 hover:text-signal-700"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-signal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-signal-800/25 transition duration-200 ease-out hover:bg-signal-800 active:scale-95"
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
        {/* soft brand wash behind the hero */}
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-signal-100/60 blur-[120px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-accent-100/50 blur-[120px]"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-[1600px] items-center gap-8 px-5 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6 lg:pt-14">
          <div>
            <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-signal-200 bg-signal-50 px-3.5 py-1.5 text-xs font-medium text-signal-800">
              <span className="animate-live h-2 w-2 rounded-full bg-rose-500" />
              For independent instructors — live, not pre-recorded
            </Reveal>
            <WordReveal
              text="Teach your class live, to a room that shows up."
              highlight="live"
              className="mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] text-neutral-950 sm:text-6xl lg:text-7xl"
            />
            <Reveal delay={0.15} className="mt-6 max-w-md text-lg leading-relaxed text-neutral-600">
              Run your own live classes in one room — video, a shared chalkboard,
              quizzes, and a leaderboard. With add-on packs for Qur&apos;an, code,
              and exams. Built to keep working even on slow, low-data connections.
            </Reveal>
            <Reveal delay={0.25} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-signal-800/25 transition duration-200 ease-out hover:bg-signal-800 active:scale-[0.97]"
              >
                Get started free
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 transition duration-200 ease-out hover:border-signal-500 hover:text-signal-700 active:scale-[0.97]"
              >
                Browse courses
              </Link>
            </Reveal>
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

      {/* ============================ METRICS BAND ============================ */}
      <section className="border-b border-neutral-200 bg-signal-50/40">
        <div className="mx-auto max-w-[1600px] px-5 py-12">
          <Stagger className="grid grid-cols-2 gap-6 sm:grid-cols-4" as="div">
            {[
              { to: 40, suffix: '+', label: 'Students in one live room' },
              { to: 6, suffix: '×', label: 'Tools replaced by one room' },
              { to: 3, suffix: '', label: 'Teaching add-on packs' },
              { to: 0, suffix: '', label: 'Downloads to join a class' },
            ].map((m) => (
              <StaggerItem key={m.label} className="text-center sm:text-left">
                <div className="font-display text-4xl font-extrabold tracking-tight text-signal-700 sm:text-5xl">
                  <CountUp to={m.to} suffix={m.suffix} />
                </div>
                <p className="mt-1.5 text-sm text-neutral-600">{m.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section id="features" className="scroll-mt-20 border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-signal-700">
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

            <Stagger as="ul" className="divide-y divide-neutral-200 border-t border-neutral-200">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <StaggerItem
                  as="li"
                  key={title}
                  className="group flex gap-5 py-7 sm:gap-7"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-neutral-200 bg-white text-signal-700 transition-colors duration-200 group-hover:border-signal-600 group-hover:bg-signal-600 group-hover:text-white">
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
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ============================ COMPARISON TABLE ============================ */}
      <section id="compare" className="scroll-mt-20 border-b border-neutral-200 bg-neutral-50/60">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-signal-700">One subscription, not five</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              What replaces the whole stack.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              Teaching live usually means a video app, a whiteboard, a quiz tool,
              a classroom, and a certificate service — five logins, five bills, and
              students bouncing between tabs. Here it is one room.
            </p>
          </div>

          <Reveal className="mt-12 overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">
                Capabilities of single-purpose tools compared with livetich
              </caption>
              <thead>
                <tr className="border-b border-neutral-200">
                  <th scope="col" className="px-5 py-4 text-left font-semibold text-neutral-950">
                    Capability
                  </th>
                  {COMPARE_COLS.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-3 py-4 text-center align-bottom font-medium text-neutral-500"
                    >
                      {c}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="whitespace-nowrap rounded-t-2xl bg-signal-700 px-4 py-4 text-center font-bold text-white"
                  >
                    livetich
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={ri % 2 ? 'bg-neutral-50/50' : 'bg-white'}
                  >
                    <th scope="row" className="px-5 py-3.5 text-left font-medium text-neutral-800">
                      {row.label}
                    </th>
                    {row.others.map((c, ci) => (
                      <td key={ci} className="px-3 py-3.5 text-center">
                        <Mark v={c} />
                      </td>
                    ))}
                    <td className="bg-signal-50/70 px-4 py-3.5 text-center ring-1 ring-inset ring-signal-100">
                      <Mark v={row.livetich} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><Mark v="yes" /> Full support</span>
            <span className="inline-flex items-center gap-1.5"><Mark v="part" /> Partial / clunky</span>
            <span className="inline-flex items-center gap-1.5"><Mark v="no" /> Not offered</span>
          </p>
        </div>
      </section>

      {/* ============================ ADD-ON PACKS + CAPABILITY TABLE ============ */}
      <section id="packs" className="scroll-mt-20 border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-signal-700">Built for what you teach</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              One core classroom. Packs for your subject.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              Every account gets the full live classroom. Turn on an add-on pack
              and the room grows the exact tools your subject needs — nothing more
              to configure, nothing you don&apos;t use.
            </p>
          </div>

          <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" as="div">
            {PACKS.map(({ icon: Icon, name, tagline, features, tint }) => (
              <StaggerItem
                key={name}
                className="group flex flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-signal-300 hover:shadow-lg hover:shadow-signal-900/5"
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${
                    tint === 'accent' ? 'bg-accent-600' : 'bg-signal-700'
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <p className={`mt-4 text-[11px] font-semibold uppercase tracking-wide ${tint === 'accent' ? 'text-accent-700' : 'text-signal-700'}`}>
                  {tagline}
                </p>
                <h3 className="mt-1 text-lg font-bold tracking-tight text-neutral-950">
                  {name}
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-neutral-600">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${tint === 'accent' ? 'text-accent-600' : 'text-signal-600'}`}
                        weight="bold"
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Capability table — pack → what it adds → who it's for */}
          <Reveal className="mt-12 overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <caption className="sr-only">Add-on packs and what each includes</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70">
                  <th scope="col" className="px-5 py-4 text-left font-semibold text-neutral-950">Pack</th>
                  <th scope="col" className="px-5 py-4 text-left font-semibold text-neutral-950">What it adds to the room</th>
                  <th scope="col" className="px-5 py-4 text-left font-semibold text-neutral-950">Best for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {[
                  { name: 'Core classroom', adds: 'Live video, chalkboard, buzzer quizzes, leaderboard, scheduling, certificates', who: 'Every instructor' },
                  { name: 'Islamic education', adds: 'Hifz tracking, shared Qur’an reader, live Hifz panel, Tajwīd feedback', who: 'Qur’an & madrasah teachers' },
                  { name: 'Code instruction', adds: 'Shared code editor, live code-submission review, per-exercise languages', who: 'Coding bootcamps & tutors' },
                  { name: 'Test prep', adds: 'Exam manager, timed assessments, AI question drafting, study groups', who: 'Exam & certification prep' },
                ].map((r) => (
                  <tr key={r.name} className="align-top transition-colors hover:bg-signal-50/40">
                    <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-semibold text-neutral-950">
                      {r.name}
                    </th>
                    <td className="px-5 py-4 text-neutral-600">{r.adds}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-neutral-600">{r.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ============================ PROGRAM ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-signal-700">Beyond the live room</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
              Everything it takes to run a cohort.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-600">
              The live class is the moment — but a program is more than a moment.
              livetich runs the schedule, the coursework, the roster, and the
              credential, so the whole thing lives in one place.
            </p>
          </div>

          <Stagger className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" as="div">
            {PROGRAM.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title} className="group">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-neutral-200 bg-white text-signal-700 transition-colors duration-200 group-hover:border-signal-600 group-hover:bg-signal-600 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-neutral-950">
                  {title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-neutral-600">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ USE CASES (dark) ============================ */}
      <section className="relative overflow-hidden bg-signal-900">
        <div
          className="pointer-events-none absolute -left-16 top-24 h-80 w-80 rounded-full bg-signal-500/20 blur-[80px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-accent-500/10 blur-[90px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-signal-300">
              Built for cohorts of every kind
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl">
              Wherever people learn together.
            </h2>
          </div>
          <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" as="div">
            {USE_CASES.map(({ icon: Icon, title, body }) => (
              <StaggerItem
                key={title}
                className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:bg-white/[0.1]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-md">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-white">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-signal-200/80">
                  {body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
            From empty room to full cohort.
          </h2>
          <Stagger as="ol" className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(({ title, body }, i) => (
              <StaggerItem as="li" key={title} className="relative">
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
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ BUZZER SPOTLIGHT ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700">
              <Lightning className="h-3.5 w-3.5" aria-hidden weight="fill" /> Buzzer rounds
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
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal-600 text-white">
                    <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Authored buzzer card — real feature values, not a faked app shell. */}
          <Reveal delay={0.1} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-950">Buzzer round</p>
              <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" />
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
                      <Check className="h-4 w-4" weight="bold" aria-hidden /> Ada, +25
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================ FOR INSTRUCTORS ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
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
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal-600 text-white">
                    <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-signal-800/25 transition duration-200 ease-out hover:bg-signal-800 active:scale-[0.97]"
              >
                Start teaching
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </Reveal>

          {/* Advertising image — a real teaching moment. */}
          <Reveal delay={0.1} className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-900/5">
            <Image
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
              alt="An instructor teaching a live class"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-signal-900/40 to-transparent" aria-hidden />
          </Reveal>
        </div>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      <section className="border-b border-neutral-200 bg-signal-50/50">
        <div className="mx-auto max-w-[1000px] px-5 py-20 text-center sm:py-24">
          <Reveal>
            <Quotes className="mx-auto h-9 w-9 text-signal-300" weight="fill" aria-hidden />
            <blockquote className="mt-6 font-display text-2xl font-bold leading-snug tracking-tight text-neutral-950 sm:text-3xl">
              &ldquo;My students used to drift off in a silent video call. Now the
              buzzer rounds and the shared board keep every one of them leaning in
              — and I run the whole class from one tab.&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-signal-700 text-sm font-semibold text-white">UM</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-neutral-950">Ustadha Maryam</p>
                <p className="text-xs text-neutral-500">Qur&apos;an &amp; Tajwīd instructor</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-signal-700">Good questions</p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
                Answered.
              </h2>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-neutral-600">
                Everything worth knowing before your first live class.
              </p>
            </div>
            <Stagger as="dl" className="divide-y divide-neutral-200 border-t border-neutral-200">
              {FAQ.map(({ q, a }) => (
                <StaggerItem key={q} className="py-6">
                  <dt className="text-lg font-bold tracking-tight text-neutral-950">
                    {q}
                  </dt>
                  <dd className="mt-2 leading-relaxed text-neutral-600">{a}</dd>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-signal-900 px-6 py-16 text-center sm:px-16 sm:py-20">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-signal-500/30 blur-[110px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent-500/20 blur-[110px]"
              aria-hidden
            />
            <Reveal className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl">
                Your next cohort is waiting for a better class.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg text-signal-100/90">
                Spin up a live room, invite your students, and teach the way the
                internet should have let you all along.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-signal-800 shadow-lg transition duration-200 ease-out hover:bg-signal-50 active:scale-[0.97]"
                >
                  Get started free
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/10 active:scale-[0.97]"
                >
                  Browse courses
                </Link>
              </div>
            </Reveal>
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
            <Link href="/courses" className="hover:text-signal-700">Browse courses</Link>
            <Link href="/login" className="hover:text-signal-700">Log in</Link>
            <Link href="/register" className="hover:text-signal-700">Get started</Link>
            <Link href="/privacy" className="hover:text-signal-700">Privacy</Link>
            <Link href="/terms" className="hover:text-signal-700">Terms</Link>
          </nav>
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} livetich. Learn skills live.
          </p>
        </div>
      </footer>
    </div>
  );
}
