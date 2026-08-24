import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { BrandLogo } from '@/components/brand-logo';
import { HeroSphere } from '@/components/hero-sphere';
import { LiveClock } from '@/components/live-clock';
import { LandingGsap } from '@/components/landing-gsap';
import { LandingCursor } from '@/components/landing-cursor';
import { ThemeToggle } from '@/components/theme-toggle';
import { Reveal, Stagger, StaggerItem, CountUp } from '@/components/landing-motion';
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
  NotePencil,
  PenNib,
  Quotes,
  Sparkle,
  Trophy,
  UsersThree,
  WifiHigh,
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

/* Honest hero telemetry — reference-style stat readouts, real livetich values
 * (no fabricated uptime/throughput numbers; see PRODUCT.md "claim only what's
 * true"). Rendered over the globe on large screens, stacked on small ones. */
const HERO_STATS = [
  { k: 'live_classroom', v: 'One room' },
  { k: 'teaching_packs', v: '3' },
  { k: 'to_join', v: '0 downloads' },
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
const CORE_PACK = {
  icon: BookOpenText,
  name: 'The live classroom',
  bestFor: 'Every instructor',
  features: [
    'Live video + shared chalkboard',
    'Buzzer quizzes & live leaderboard',
    'Raise-hand queue & moderated chat',
    'Scheduling, rosters & certificates',
  ],
};
const ADDON_PACKS = [
  {
    icon: Sparkle,
    name: 'Islamic education',
    bestFor: 'Qur’an & madrasah teachers',
    features: [
      'Hifz memorisation tracking',
      'Shared Uthmani Qur’an reader',
      'Live Hifz panel + audio review',
      'Tajwīd worksheets & feedback',
    ],
  },
  {
    icon: Code,
    name: 'Code instruction',
    bestFor: 'Coding bootcamps & tutors',
    features: [
      'Shared in-room code editor',
      'Live code-submission review',
      'Language picker per exercise',
      'Run students’ code together, live',
    ],
  },
  {
    icon: Exam,
    name: 'Test prep',
    bestFor: 'Exam & certification prep',
    features: [
      'Exam manager & question bank',
      'Timed assessments with accuracy',
      'AI-assisted question drafting',
      'Study groups & cohorts',
    ],
  },
];

/* "The stack vs. one room" comparison. Each single-purpose tool covers one
 * slice; livetich covers all of it in one place. */
const STACK_TOOLS = [
  { icon: Broadcast, name: 'Video app', does: 'Just the video call' },
  { icon: PenNib, name: 'Whiteboard', does: 'Just a shared canvas' },
  { icon: Trophy, name: 'Quiz app', does: 'Just quizzes & points' },
  { icon: CalendarCheck, name: 'Classroom', does: 'Just scheduling & rosters' },
  { icon: Certificate, name: 'Cert tool', does: 'Just certificates' },
];
const CAPABILITIES = [
  'Live video for a whole cohort',
  'Real-time shared chalkboard',
  'Buzzer quizzes with live points',
  'Live leaderboard',
  'Scheduling, rosters & grading',
  'Verifiable certificates',
  'Works on 2G / data-saver',
  'Everyone in one room',
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

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <div id="landing-nav" className="sticky top-0 z-50">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-5 lg:h-20">
        <Link href="/" className="nav-brand flex shrink-0 items-center gap-2.5">
          <BrandLogo themed className="h-20 w-auto sm:h-14 lg:h-20" />
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Link
            href="#features"
            className="nav-link hidden rounded-full px-4 py-2 text-sm font-medium md:block"
          >
            Features
          </Link>
          <Link
            href="#compare"
            className="nav-link hidden rounded-full px-4 py-2 text-sm font-medium md:block"
          >
            Compare
          </Link>
          <Link
            href="/courses"
            className="nav-link hidden rounded-full px-4 py-2 text-sm font-medium sm:block"
          >
            Browse courses
          </Link>
          <ThemeToggle />
          {user ? (
            <Link
              href="/dashboard"
              className="nav-cta whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm transition duration-200 ease-out active:scale-95 sm:px-4"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="nav-link whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium sm:px-4"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="nav-cta hidden whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm transition duration-200 ease-out active:scale-95 sm:inline-block sm:px-4"
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
    <div className="lp-root flex flex-col bg-lp-bg text-lp-text-2">
      {/* No-JS fallback: reveal anything the anti-FOUC CSS hid for the entrance. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html:
              '[data-hero] [data-anim],[data-hero] [data-anim-line],[data-hero] [data-globe]{opacity:1!important;transform:none!important}',
          }}
        />
      </noscript>

      <LandingNav />
      <LandingGsap />
      <LandingCursor />

      {/* ===================== HERO — big globe, integrated header ============= */}
      <section
        data-hero
        className="relative -mt-16 flex min-h-[100svh] flex-col overflow-hidden bg-lp-bg text-lp-text"
      >
        {/* faint scan grid (parallax) */}
        <div
          data-hero-grid
          aria-hidden
          className="pointer-events-none absolute inset-0 -top-[15%] h-[130%] opacity-[0.05] [background-image:linear-gradient(rgba(163,230,53,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(163,230,53,.6)_1px,transparent_1px)] [background-size:44px_44px]"
        />

        {/* the globe — oversized, anchored right, bleeding ~half off the edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 w-[600px] max-w-none -translate-y-1/2 translate-x-[30%] sm:w-[760px] sm:translate-x-[26%] lg:w-[1180px] lg:translate-x-[28%]"
        >
          <div data-globe className="opacity-90">
            <HeroSphere className="w-full" />
          </div>
        </div>

        {/* left→right readability veil so the headline stays crisp over the globe */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-lp-bg via-lp-bg/85 to-lp-bg/10 lg:via-lp-bg/70 lg:to-transparent"
        />
        {/* bottom vignette into the metadata bar */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-lp-bg to-transparent"
        />

        {/* stats overlaid on the globe (reference-style) — large screens only */}
        <div className="pointer-events-none absolute right-[7%] top-1/2 z-20 hidden w-60 -translate-y-1/2 lg:block">
          <dl className="space-y-8">
            {HERO_STATS.map((s) => (
              <div key={s.k} data-anim="metric" className="border-t border-lp-border-2 pt-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-lp-lime/75 [text-shadow:0_1px_6px_rgba(5,19,15,0.8)]">
                  {s.k}
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tracking-tight text-lp-text [text-shadow:0_1px_10px_rgba(5,19,15,0.85)]">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-5 pt-16">
          {/* ---- top status bar ---- */}
          <div
            data-anim="status"
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-lp-border py-3 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            <div className="flex items-center gap-2.5">
              <span className="animate-live h-2 w-2 rounded-full bg-lp-accent" />
              <span className="font-semibold text-lp-text">livetich</span>
              <span className="text-lp-lime/55">/ live.classroom</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-lp-lime/85">
              <span>
                <span className="text-lp-lime/45">time </span>
                <LiveClock className="text-lp-lime" />
              </span>
              <span className="hidden sm:inline">
                <span className="text-lp-lime/45">mode </span>in-browser
              </span>
              <span>
                <span className="text-lp-lime/45">net </span>data-saver ready
              </span>
            </div>
          </div>

          {/* ---- headline block ---- */}
          <div className="flex flex-1 items-center py-14 lg:py-16">
            <div className="max-w-3xl">
              <span
                data-anim="eyebrow"
                className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-lp-lime"
              >
                <span className="h-px w-6 bg-lp-accent" />
                System ready
              </span>

              <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
                {[
                  ['One live room', 'text-lp-text'],
                  ['for your whole', 'text-lp-text'],
                  ['cohort.', 'text-lp-lime'],
                ].map(([word, tone]) => (
                  <span key={word} className="block overflow-hidden pb-[0.06em]">
                    <span data-anim-line className={`block ${tone}`}>
                      {word}
                    </span>
                  </span>
                ))}
              </h1>

              <p
                data-anim="sub"
                className="mt-8 max-w-xl font-mono text-sm leading-relaxed text-lp-text-2/80"
              >
                One live room for your whole cohort — video, a shared chalkboard,
                buzzer quizzes, and a leaderboard. Built to keep working on slow,
                low-data connections.
              </p>

              {/* CTA row */}
              <div
                data-anim="cta"
                className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
              >
                <Link
                  href="/register"
                  className="group inline-flex items-center justify-between gap-3 rounded-sm bg-lp-accent px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.12em] text-[#05130f] transition hover:bg-lp-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lp-bg"
                >
                  Launch your class
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M5 11 11 5M6 5h5v5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Link
                  href="#features"
                  className="font-mono text-xs uppercase tracking-[0.16em] text-lp-lime/80 underline-offset-4 transition hover:text-lp-text hover:underline"
                >
                  See how it works
                </Link>
              </div>

              {/* honest metrics — inline on small screens (the overlaid version
                  sits on the globe at lg+) */}
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-lp-border pt-6 lg:hidden">
                {HERO_STATS.map((m) => (
                  <div key={m.k} data-anim="metric">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-lp-lime/70">
                      {m.k}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tracking-tight text-lp-text">
                      {m.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* ---- bottom metadata bar ---- */}
          <div
            data-anim="footer"
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-lp-border py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-lp-lime/45"
          >
            <span>one live room · whole cohort · no installs</span>
            <span>© {new Date().getFullYear()} livetich · learn skills live</span>
          </div>
        </div>
      </section>

      {/* ============================ METRICS BAND ============================ */}
      <section className="border-b border-lp-border bg-lp-alt">
        <div className="mx-auto max-w-[1600px] px-5 py-10 sm:py-12">
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-lp-lime/70">
            <span className="h-px w-6 bg-lp-accent/50" /> live metrics
          </div>
          <Stagger
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-lp-border bg-lp-surface-2 sm:grid-cols-4"
            as="div"
          >
            {[
              { k: 'cohort_size', to: 40, suffix: '+', label: 'Students in one live room' },
              { k: 'tools_replaced', to: 6, suffix: '×', label: 'Tools replaced by one room' },
              { k: 'add_on_packs', to: 3, suffix: '', label: 'Teaching add-on packs' },
              { k: 'to_join', to: 0, suffix: '', label: 'Downloads to join a class' },
            ].map((m) => (
              <StaggerItem
                key={m.label}
                className="bg-lp-bg p-6 transition-colors duration-200 hover:bg-lp-alt"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lp-text-3">
                  {m.k}
                </p>
                <div className="mt-2 font-display text-4xl font-extrabold tracking-tight text-lp-lime sm:text-5xl">
                  <CountUp to={m.to} suffix={m.suffix} />
                </div>
                <p className="mt-1.5 text-sm text-lp-text-2">{m.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section id="features" className="scroll-mt-20 border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-lp-lime">
                One room, not a toolchain
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
                A whole classroom, not a stack of tools.
              </h2>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-lp-text-2">
                Stop stitching together a video call, a chat app, a quiz tool,
                and a slide deck. livetich is one place built for teaching live.
              </p>
            </div>

            <Stagger as="ul" className="divide-y divide-lp-border border-t border-lp-border">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <StaggerItem
                  as="li"
                  key={title}
                  className="group flex gap-5 py-7 sm:gap-7"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-lp-border bg-lp-surface-2 text-lp-lime transition-colors duration-200 group-hover:border-lp-accent group-hover:bg-lp-accent group-hover:text-[#05130f]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-lp-text">
                      {title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-lp-text-2">
                      {body}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ===================== STACK vs. ONE ROOM ===================== */}
      <section id="compare" className="scroll-mt-20 border-b border-lp-border bg-lp-alt">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-lp-lime">One subscription, not five</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              What replaces the whole stack.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-lp-text-2">
              Teaching live usually means five single-purpose tools — a video app,
              a whiteboard, a quiz tool, a classroom, and a certificate service.
              Five logins, five bills, students bouncing between tabs.
            </p>
          </div>

          <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-[1fr_1.15fr]">
            {/* LEFT — the patchwork stack */}
            <Reveal className="flex flex-col rounded-3xl border border-lp-border bg-lp-alt p-6 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lp-text-3">
                  the usual stack
                </p>
                <span className="rounded-full border border-lp-border bg-lp-alt px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-lp-text-3">
                  5 apps · 5 bills
                </span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {STACK_TOOLS.map(({ icon: Icon, name, does }) => (
                  <li
                    key={name}
                    className="flex items-center gap-4 rounded-2xl border border-lp-border bg-lp-alt px-4 py-3.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-lp-border bg-lp-alt text-lp-text-3">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-medium text-lp-text-2">{name}</span>
                    <span className="ml-auto text-right text-xs text-lp-text-3">
                      {does}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 border-t border-lp-border pt-5 text-sm text-lp-text-3">
                Five tabs to juggle — and students still bounce between them.
              </p>
            </Reveal>

            {/* RIGHT — one live room */}
            <Reveal
              delay={0.1}
              className="relative flex flex-col overflow-hidden rounded-3xl border border-lp-accent/30 bg-lp-accent/[0.05] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-lp-accent-strong/20 blur-[90px]"
                aria-hidden
              />
              <div className="relative flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lp-lime">
                  one live room
                </p>
                <span className="rounded-full bg-lp-accent px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#05130f]">
                  livetich
                </span>
              </div>

              <h3 className="relative mt-4 font-display text-2xl font-extrabold tracking-tight text-lp-text sm:text-3xl">
                Everything, in one tab.
              </h3>

              <ul className="relative mt-6 grid flex-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                {CAPABILITIES.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-[15px] text-lp-text-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lp-accent text-[#05130f]">
                      <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>

              <div className="relative mt-8 border-t border-lp-border pt-5">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.12em] text-lp-lime transition hover:text-lp-text"
                >
                  Replace the stack
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================ CORE + ADD-ON PACKS ============================ */}
      <section id="packs" className="scroll-mt-20 border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-lp-lime">Built for what you teach</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              One core classroom. Packs for your subject.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-lp-text-2">
              Every account gets the full live classroom. Turn on an add-on pack
              and the room grows the exact tools your subject needs — nothing more
              to configure, nothing you don&apos;t use.
            </p>
          </div>

          {/* Core — the base every account gets, highlighted */}
          <Reveal className="relative mt-14 overflow-hidden rounded-3xl border border-lp-accent/30 bg-lp-accent/[0.05] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-lp-accent-strong/20 blur-[90px]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lp-accent text-[#05130f]">
                    <CORE_PACK.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="rounded-full bg-lp-accent/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-lp-lime">
                    Included free
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-lp-text sm:text-3xl">
                  {CORE_PACK.name}
                </h3>
                <p className="mt-2 text-sm text-lp-text-2">
                  The full room every account starts with —{' '}
                  <span className="text-lp-text-2">for {CORE_PACK.bestFor.toLowerCase()}</span>.
                </p>
              </div>

              <ul className="grid flex-1 gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:max-w-xl">
                {CORE_PACK.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-lp-text-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lp-accent text-[#05130f]">
                      <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Add-on packs — turn on only what your subject needs */}
          <div className="mt-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-lp-text-3">
            <span className="h-px w-6 bg-lp-surface-3" /> add-on packs
          </div>
          <Stagger className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" as="div">
            {ADDON_PACKS.map(({ icon: Icon, name, bestFor, features }) => (
              <StaggerItem
                key={name}
                className="group flex flex-col rounded-3xl border border-lp-border bg-lp-surface p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-lp-accent/40 hover:bg-lp-surface-3"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-lp-border bg-lp-surface-2 text-lp-lime transition-colors duration-200 group-hover:border-lp-accent group-hover:bg-lp-accent group-hover:text-[#05130f]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-lp-text-3">
                    add-on
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-lp-text">
                  {name}
                </h3>
                <p className="mt-1 text-xs text-lp-text-3">For {bestFor.toLowerCase()}</p>
                <ul className="mt-4 space-y-2.5 border-t border-lp-border pt-4 text-sm text-lp-text-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-lp-lime"
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
        </div>
      </section>

      {/* ============================ PROGRAM ============================ */}
      <section className="border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-lp-lime">Beyond the live room</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              Everything it takes to run a cohort.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-lp-text-2">
              The live class is the moment — but a program is more than a moment.
              livetich runs the schedule, the coursework, the roster, and the
              credential, so the whole thing lives in one place.
            </p>
          </div>

          <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" as="div">
            {PROGRAM.map(({ icon: Icon, title, body }) => (
              <StaggerItem
                key={title}
                className="group rounded-3xl border border-lp-border bg-lp-surface p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-lp-accent/40 hover:bg-lp-surface-3"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-lp-border bg-lp-surface-2 text-lp-lime transition-colors duration-200 group-hover:border-lp-accent group-hover:bg-lp-accent group-hover:text-[#05130f]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-lp-text">
                  {title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-lp-text-2">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ USE CASES (dark) ============================ */}
      <section className="relative overflow-hidden border-y border-lp-border bg-lp-alt">
        <div
          data-parallax="-14"
          className="pointer-events-none absolute -left-16 top-24 h-80 w-80 rounded-full bg-lp-accent-strong/20 blur-[80px]"
          aria-hidden
        />
        <div
          data-parallax="12"
          className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-accent-500/10 blur-[90px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-lp-lime">
              Built for cohorts of every kind
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              Wherever people learn together.
            </h2>
          </div>
          <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" as="div">
            {USE_CASES.map(({ icon: Icon, title, body }) => (
              <StaggerItem
                key={title}
                className="rounded-3xl border border-lp-border bg-lp-surface-2 p-6 shadow-xl shadow-black/20 backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:bg-lp-surface-3"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-lp-border-2 bg-lp-surface-3 text-lp-text backdrop-blur-md">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-lp-text">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-lp-text-2">
                  {body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
            From empty room to full cohort.
          </h2>
          <Stagger as="ol" className="mt-14 grid gap-5 sm:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <StaggerItem
                as="li"
                key={title}
                className="group relative overflow-hidden rounded-3xl border border-lp-border bg-lp-surface p-7 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-lp-accent/40 hover:bg-lp-surface-3"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-4 -top-6 font-display text-[7rem] font-extrabold leading-none tracking-tight text-lp-text/[0.04]"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative flex items-baseline gap-2.5">
                  <span className="font-display text-4xl font-extrabold tracking-tight text-lp-lime">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lp-text-3">
                    / step
                  </span>
                </div>
                <h3 className="relative mt-6 text-xl font-bold tracking-tight text-lp-text">
                  {title}
                </h3>
                <p className="relative mt-2 leading-relaxed text-lp-text-2">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================ BUZZER SPOTLIGHT ============================ */}
      <section className="border-b border-lp-border">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-lp-accent/10 px-3 py-1 text-xs font-semibold text-lp-lime">
              <Lightning className="h-3.5 w-3.5" aria-hidden weight="fill" /> Buzzer rounds
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              Turn quiet lectures into a game show.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-lp-text-2">
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
                <li key={t} className="flex items-start gap-3 text-lp-text-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lp-accent text-[#05130f]">
                    <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Authored buzzer card — real feature values, not a faked app shell. */}
          <Reveal delay={0.1} className="rounded-3xl border border-lp-border bg-lp-surface p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-lp-text">Buzzer round</p>
              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/25">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-400" />
                0:12
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold tracking-tight text-lp-text">
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
                      ? 'border-lp-accent/60 bg-lp-accent/10 text-lp-text'
                      : 'border-lp-border bg-lp-surface text-lp-text-2'
                  }`}
                >
                  {opt}
                  {correct && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-lp-lime">
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
      <section className="border-b border-lp-border">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-lp-accent/10 px-3 py-1 text-xs font-semibold text-lp-lime">
              <UsersThree className="h-3.5 w-3.5" aria-hidden /> For every kind of instructor
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              Whatever you teach, run it live.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-lp-text-2">
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
                <li key={t} className="flex items-start gap-3 text-lp-text-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lp-accent text-[#05130f]">
                    <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-lp-accent px-6 py-3.5 text-sm font-semibold text-[#05130f] shadow-lg shadow-black/30 transition duration-200 ease-out hover:bg-lp-accent-strong active:scale-[0.97]"
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
          <Reveal delay={0.1} className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-lp-border shadow-xl shadow-neutral-900/5">
            <Image
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
              alt="An instructor teaching a live class"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-lp-bg via-lp-bg/20 to-transparent" aria-hidden />
          </Reveal>
        </div>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      <section className="border-b border-lp-border bg-lp-alt">
        <div className="mx-auto max-w-[1000px] px-5 py-20 sm:py-24">
          <Reveal className="relative overflow-hidden rounded-[2rem] border border-lp-border bg-lp-surface px-6 py-14 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:px-14">
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-lp-accent-strong/10 blur-[90px]"
              aria-hidden
            />
            <Quotes className="relative mx-auto h-9 w-9 text-lp-lime" weight="fill" aria-hidden />
            <blockquote className="relative mt-6 font-display text-2xl font-bold leading-snug tracking-tight text-lp-text sm:text-3xl">
              &ldquo;My students used to drift off in a silent video call. Now the
              buzzer rounds and the shared board keep every one of them leaning in
              — and I run the whole class from one tab.&rdquo;
            </blockquote>
            <div className="relative mt-8 flex items-center justify-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-lp-accent text-sm font-semibold text-[#05130f]">
                UM
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-lp-text">Ustadha Maryam</p>
                <p className="text-xs text-lp-text-3">Qur&apos;an &amp; Tajwīd instructor</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold text-lp-lime">Good questions</p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
                Answered.
              </h2>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-lp-text-2">
                Everything worth knowing before your first live class.
              </p>
            </div>
            <Stagger as="dl" className="divide-y divide-lp-border border-t border-lp-border">
              {FAQ.map(({ q, a }) => (
                <StaggerItem key={q} className="py-6">
                  <dt className="text-lg font-bold tracking-tight text-lp-text">
                    {q}
                  </dt>
                  <dd className="mt-2 leading-relaxed text-lp-text-2">{a}</dd>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="bg-lp-bg">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-24">
          <div className="relative overflow-hidden rounded-[2rem] border border-lp-accent/30 bg-lp-surface px-6 py-16 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:px-16 sm:py-20">
            <div
              data-parallax="-16"
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lp-accent-strong/30 blur-[110px]"
              aria-hidden
            />
            <div
              data-parallax="14"
              className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent-500/20 blur-[110px]"
              aria-hidden
            />
            <Reveal className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
                Your next cohort is waiting for a better class.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg text-lp-text-2/90">
                Spin up a live room, invite your students, and teach the way the
                internet should have let you all along.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-lp-accent px-6 py-3.5 text-sm font-semibold text-[#05130f] shadow-lg transition duration-200 ease-out hover:bg-lp-accent-strong active:scale-[0.97]"
                >
                  Get started free
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-full border border-lp-border-2 bg-lp-surface-2 px-6 py-3.5 text-sm font-semibold text-lp-text transition duration-200 ease-out hover:bg-lp-surface-3 active:scale-[0.97]"
                >
                  Browse courses
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-lp-border bg-lp-bg">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-6 px-5 py-9 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo themed className="h-20 w-auto sm:h-12" />
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-sm font-medium text-lp-text-3 sm:justify-start">
            <Link href="/courses" className="hover:text-lp-lime">Browse courses</Link>
            <Link href="/login" className="hover:text-lp-lime">Log in</Link>
            <Link href="/register" className="hover:text-lp-lime">Get started</Link>
            <Link href="/privacy" className="hover:text-lp-lime">Privacy</Link>
            <Link href="/terms" className="hover:text-lp-lime">Terms</Link>
          </nav>
          <p className="text-xs text-lp-text-3">
            © {new Date().getFullYear()} livetich. Learn skills live.
          </p>
        </div>
      </footer>
    </div>
  );
}
