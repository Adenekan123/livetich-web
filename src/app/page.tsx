import Image from 'next/image';
import Link from 'next/link';
import { Rubik } from 'next/font/google';
import { getCurrentUser } from '@/lib/auth';
import { BrandLogo } from '@/components/brand-logo';
import { LandingGsap } from '@/components/landing-gsap';
import { LandingCursor } from '@/components/landing-cursor';
import { ThemeToggle } from '@/components/theme-toggle';
import { LandingPacks } from '@/components/landing-packs';
import { LandingSteps } from '@/components/landing-steps';
import { LandingFaq } from '@/components/landing-faq';
import { Reveal, Stagger, StaggerItem, CountUp } from '@/components/landing-motion';
import {
  ArrowRight,
  Broadcast,
  Buildings,
  CalendarCheck,
  Certificate,
  ChatCircleText,
  Check,
  Code,
  Exam,
  GraduationCap,
  Lightning,
  Mosque,
  NotePencil,
  PenNib,
  Quotes,
  Sparkle,
  Trophy,
  User,
  UsersThree,
  WifiHigh,
} from '@/components/landing-icons';

// The hero and header typeface: softly rounded corners, still crisp at size.
const rubik = Rubik({ subsets: ['latin'] });

/*
 * DIRECTION — livetich landing (Persuade), v2 "warm & live"
 * THESIS: One live room where a whole cohort connects to one instructor and
 *   competes in real time — and one platform that adapts to what you teach.
 * SYSTEM: The product's teal (primary) + amber (accent) brand on white, with a
 *   dark teal "operations" band. Follows the ui-ux-pro-max Real-Time/Operations
 *   landing pattern: hero + live status, key metrics, comparison, how-it-works,
 *   CTA. Motion is scroll-revealed and reduced-motion-safe (see landing-motion).
 */

/* Letter avatars for the hero's cohort stack (the chat colours in the
 * classroom image) — no stock faces standing in for real people. */
const HERO_AVATARS = [
  { letter: 'A', bg: 'bg-[#43a047]' },
  { letter: 'T', bg: 'bg-[#4a7fd4]' },
  { letter: 'Z', bg: 'bg-[#7e57c2]' },
  { letter: 'O', bg: 'bg-[#d6557a]' },
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

/* "Built for the way you teach" — the kinds of instructor livetich serves.
 * Each line maps to something real: the add-on packs (code, Qur'an, test
 * prep) and the core room (cohorts, rosters, buzzer quizzes). */
const INSTRUCTOR_TYPES = [
  { icon: User, title: 'Tutors', body: 'Run private or small-group classes with ease.' },
  { icon: Buildings, title: 'Academies', body: 'Manage structured cohorts and multiple instructors.' },
  { icon: Code, title: 'Coding instructors', body: 'Teach live, assign tasks, and review progress.' },
  { icon: Mosque, title: 'Qur’an & Islamic studies', body: 'Support memorization, tajweed, and live recitation.' },
  { icon: Exam, title: 'Exam prep teachers', body: 'Keep students engaged with quizzes and live practice.' },
  { icon: UsersThree, title: 'Training teams', body: 'Deliver workshops, upskilling, and professional learning.' },
];

/* ------------------------------ nav ------------------------------ */

async function LandingNav() {
  // The public homepage must render even if the auth API is unreachable;
  // an indeterminate session just falls back to the logged-out nav.
  const user = await getCurrentUser().catch(() => null);
  return (
    <div id="landing-nav" className={`${rubik.className} hero-dark sticky top-0 z-50`}>
      {/* Three columns (logo | links | actions) so the links sit at the true
          centre of the bar, whatever the width of either side. */}
      <nav className="mx-auto grid h-14 max-w-[1672px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:h-16 lg:px-10 xl:h-[72px] xl:px-[64px]">
        <Link href="/" className="nav-brand flex shrink-0 items-center justify-self-start">
          {/* The wordmark PNG carries tall transparent padding; the negative
              margins keep it from setting the bar's height. */}
          <BrandLogo onDark className="-my-[12px] h-[80px] w-auto lg:h-[88px] xl:-my-[10px] xl:h-[92px]" />
        </Link>
        <div className="flex items-center gap-1 lg:gap-2 xl:gap-6">
          <Link
            href="#features"
            className="nav-link hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] md:block xl:text-[16px]"
          >
            Features
          </Link>
          <Link
            href="#packs"
            className="nav-link hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] md:block xl:text-[16px]"
          >
            Teaching packs
          </Link>
          <Link
            href="#how-it-works"
            className="nav-link hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] lg:block xl:text-[16px]"
          >
            How it works
          </Link>
          <Link
            href="#faq"
            className="nav-link hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] lg:block xl:text-[16px]"
          >
            FAQ
          </Link>
        </div>
        <div className="flex items-center gap-1 justify-self-end sm:gap-2 xl:gap-4">
          <ThemeToggle />
          {user ? (
            <Link
              href="/dashboard"
              className="nav-cta inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-medium lg:h-[42px] lg:px-5 xl:h-[46px] xl:px-6 xl:text-[16px]"
            >
              Go to dashboard
              <ArrowRight weight="bold" className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="nav-link whitespace-nowrap rounded-full px-2.5 py-2 text-[15px] sm:px-3 xl:text-[16px]"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="nav-cta hidden h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-medium sm:inline-flex lg:h-[42px] lg:px-5 xl:h-[46px] xl:px-6 xl:text-[16px]"
              >
                Get started
                <ArrowRight weight="bold" className="h-4 w-4" />
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

      {/* ======== HERO — centred headline over a three-column showcase ======== */}
      <section
        data-hero
        className={`${rubik.className} hero-dark relative isolate -mt-14 overflow-hidden bg-hero-bg text-hero-ink lg:-mt-16 xl:-mt-[72px]`}
      >
        <div aria-hidden className="hero-dots pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-[1672px] px-4 pb-20 pt-[96px] sm:px-6 sm:pt-[112px] lg:px-10 lg:pt-[120px] xl:px-[64px] xl:pb-[120px] xl:pt-[136px]">
          {/* ---- headline ---- */}
          <div className="text-center">
            {/* Named here too: the global h1-h4 rule would otherwise force Lexend. */}
            <h1
              className={`${rubik.className} mx-auto text-balance text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[50px] lg:text-[clamp(50px,4.2vw,64px)]`}
            >
              Your cohorts deserves{' '}
              <span className="text-hero-green sm:block">more than a video call.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[16px] leading-[1.55] text-hero-muted sm:text-[18px] xl:mt-6">
              Video, a shared whiteboard, quizzes, coursework and certificates in
              one classroom — built to keep working on slow connections.
            </p>
          </div>

          {/* ---- showcase: copy | classroom | copy ---- */}
          <div className="mt-14 grid items-center gap-x-10 gap-y-14 sm:mt-16 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-12 xl:mt-[72px] xl:gap-16">
            {/* left */}
            <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1 lg:gap-16">
              <div>
                <h2
                  className={`${rubik.className} text-balance text-[21px] font-medium leading-[1.3] tracking-[-0.01em] xl:text-[24px]`}
                >
                  Keep a big class switched on{' '}
                  <Trophy weight="fill" aria-hidden className="inline h-6 w-6 align-[-3px] text-[#e3a008]" />
                </h2>
                <p className="mt-4 text-[15px] leading-[1.6] text-hero-muted xl:text-[16px]">
                  Buzzer quizzes and a live leaderboard turn a passive video call
                  into friendly competition, and the server decides who answered
                  first.
                </p>
              </div>
              <div>
                <div className="flex -space-x-2.5" aria-hidden>
                  {HERO_AVATARS.map(({ letter, bg }) => (
                    <span
                      key={letter}
                      className={`grid h-11 w-11 place-items-center rounded-full text-[15px] font-semibold text-white ring-[3px] ring-hero-bg ${bg}`}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[18px] font-medium xl:text-[19px]">
                  Your whole cohort, in one room
                </p>
              </div>
            </div>

            {/* centre — the approved classroom image in a slim-bezel tablet.
                The file is untouched (unoptimized, so the bytes ship as
                delivered); the screen window frames just its dark classroom
                card — x 20–940, y 14–599 of the 941×608 file — so the pale,
                uneven margin baked into the file never shows. */}
            <div className="relative isolate order-first md:col-span-2 lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <div aria-hidden className="hero-glow pointer-events-none absolute -inset-x-[35%] -inset-y-[55%] -z-10" />
              <div className="relative rounded-[20px] bg-[#0b0f0e] p-[8px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/15 sm:rounded-[26px] sm:p-[11px]">
                {/* front camera */}
                <span
                  aria-hidden
                  className="absolute left-1/2 top-[2px] h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-white/25 sm:top-[3.5px]"
                />
                <div className="relative aspect-[921/586] overflow-hidden rounded-[1.8%/2.8%]">
                  <Image
                    src="/livetich-exact-live-session-crop.png"
                    alt="A live Livetich class: an instructor and eight students on video, with the class chat alongside"
                    width={941}
                    height={608}
                    priority
                    unoptimized
                    className="absolute left-[-2.1716%] top-[-2.389%] block h-auto w-[102.172%] max-w-none"
                  />
                </div>
              </div>
            </div>

            {/* right */}
            <div className="flex flex-col gap-6 lg:col-start-3 lg:row-start-1 lg:gap-8">
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="h-9 w-14 rounded-full bg-[#c9f2b6]" />
                <span className="h-9 w-9 rounded-full bg-[#8FE26A]" />
                <span className="h-9 w-3.5 rounded-full bg-hero-green" />
                <span className="h-9 w-14 rounded-full bg-[#8FE26A]" />
              </div>
              <p className="text-[15px] leading-[1.6] text-hero-muted xl:text-[16px]">
                For independent instructors and small academies running live
                cohorts: schedule once, teach live, grade the work, and issue
                certificates anyone can verify.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href="/register"
                  className="inline-flex h-[54px] items-center rounded-full bg-[#8FE26A] px-8 text-[17px] font-medium text-[#111] transition-colors hover:bg-[#80d85a]"
                >
                  Start teaching for free
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center gap-2 text-[16px] font-medium underline-offset-4 hover:underline"
                >
                  Explore the platform
                  <ArrowRight weight="bold" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ METRICS BAND ============================ */}
      {/* <section className="border-b border-lp-border bg-lp-alt">
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
      </section> */}

      {/* ============================ FEATURES ============================ */}
      <section id="features" className="scroll-mt-20 border-b border-lp-border">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-lp-lime">
                One room, not a toolchain
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
                A whole classroom, not a stack of tools.
              </h2>
              {/* <p className="mt-5 max-w-md text-lg leading-relaxed text-lp-text-2">
                Stop stitching together a video call, a chat app, a quiz tool,
                and a slide deck. Livetich brings teaching, engagement, and
                progress into one connected workspace.
              </p> */}
              <Link
                href="#how-it-works"
                className="mt-5 inline-flex items-center gap-1.5 text-base font-semibold text-lp-lime underline-offset-4 hover:underline"
              >
                See how it works
                <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>

              {/* The chalkboard in the live room, in an app window over a tilted
                  green card. The window frames just the image's dark app card
                  (x 39–1632, y 45–901 of 1672×941) so its pale margin never
                  shows; the file itself is untouched. */}
              <div className="relative mt-12 max-w-[640px] px-4 sm:px-6">
                <div
                  aria-hidden
                  className="absolute inset-x-0 -inset-y-5 -rotate-[3deg] rounded-[32px] bg-[#e3f5da]"
                />
                <span aria-hidden className="absolute -left-1 top-1 h-[3px] w-5 rotate-[40deg] rounded-full bg-lp-lime/70" />
                <span aria-hidden className="absolute left-2 -top-3 h-[3px] w-5 rotate-[65deg] rounded-full bg-lp-lime/70" />
                <span aria-hidden className="absolute -right-2 top-1/2 h-[3px] w-5 -rotate-[25deg] rounded-full bg-lp-lime/70" />
                <span aria-hidden className="absolute -right-3 top-[calc(50%+12px)] h-[3px] w-4 rounded-full bg-lp-lime/70" />
                <div className="relative overflow-hidden rounded-[16px] bg-[#0b0f0e] p-[5px] shadow-[0_30px_60px_-25px_rgba(5,19,15,0.45)]">
                  <div className="relative aspect-[1594/857] overflow-hidden rounded-[1%/1.9%]">
                    <Image
                      src="/livetich-chalkboard-session.png"
                      alt="The shared chalkboard in a Livetich live class: a hand-drawn photosynthesis lesson beside the class chat"
                      width={1672}
                      height={941}
                      unoptimized
                      className="absolute left-[-2.4467%] top-[-5.2509%] block h-auto w-[104.893%] max-w-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Stagger as="ul" className="divide-y divide-lp-border border-t border-lp-border lg:self-start">
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

      {/* ===================== BUILT FOR THE WAY YOU TEACH ===================== */}
      <section id="compare" className="scroll-mt-20 border-b border-lp-border bg-lp-alt">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-lp-lime">
                Created for all types of instructors
              </p>
              <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
                Where every kind of instructor belongs.
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-lp-text-2">
                Whether you teach academic subjects, coding, Qur’an, exam prep,
                professional training, or group programs, Livetich gives you one
                live teaching workspace designed to fit your style.
              </p>
            </div>

            <Stagger className="grid gap-5 sm:grid-cols-2" as="ul">
              {INSTRUCTOR_TYPES.map(({ icon: Icon, title, body }) => (
                <StaggerItem
                  as="li"
                  key={title}
                  className="group flex gap-4 rounded-3xl border border-lp-border bg-lp-surface-2 p-6 transition duration-200 hover:-translate-y-1 hover:bg-lp-surface-3"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-lp-border bg-lp-surface-2 text-lp-lime transition-colors duration-200 group-hover:border-lp-accent group-hover:bg-lp-accent group-hover:text-[#05130f]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-lp-text">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-lp-text-2">{body}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          <div className="mt-14 flex items-center gap-3 border-t border-lp-border pt-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lp-border bg-lp-surface-2 text-lp-lime">
              <Sparkle weight="fill" className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm text-lp-text-2">One platform. Many teaching styles.</p>
          </div>
        </div>
      </section>

      {/* ============================ TEACHING PACKS ============================ */}
      <LandingPacks />

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
      <LandingSteps />

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

      {/* ============================ FOR TEAMS ============================ */}
      <section className="border-b border-lp-border">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[0.9fr_1fr] lg:gap-14">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-lp-accent/15 px-4 py-2 text-sm font-semibold text-lp-lime">
              <UsersThree className="h-4 w-4" aria-hidden /> For teams &amp; organizations
            </span>
            <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-lp-text sm:text-5xl lg:whitespace-nowrap lg:text-[clamp(34px,2.9vw,52px)]">
              Train teams. Run learning live.
            </h2>
            <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-lp-text-2 sm:text-xl">
              Livetich helps companies run onboarding, internal training, partner
              enablement, and cohort-based learning in one place.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                'Live onboarding and team workshops',
                'Structured cohorts for employees and partners',
                'Attendance, assignments, and progress in one workspace',
                'Completion certificates for training and compliance',
              ].map((t) => (
                <li key={t} className="flex items-center gap-4 text-lg text-lp-text-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lp-accent text-[#05130f]">
                    <Check className="h-4 w-4" weight="bold" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            {/* <div className="mt-10">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-lp-accent px-9 py-4 text-lg font-semibold text-[#05130f] shadow-[0_12px_28px_-10px_rgba(101,163,13,0.6)] transition duration-200 ease-out hover:bg-lp-accent-strong active:scale-[0.97]"
              >
                Book a demo
                <ArrowRight
                  className="h-5 w-5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div> */}
          </Reveal>

          <Reveal
            delay={0.1}
            className="relative aspect-[896/647] overflow-hidden rounded-[26px] shadow-[0_24px_60px_-28px_rgba(15,46,42,0.35)]"
          >
            <Image
              src="/livetich-team-training.png"
              alt="A facilitator leads a live team training session, with remote colleagues joining on the screen behind her"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      {/* <section className="border-b border-lp-border bg-lp-alt">
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
      </section> */}

      {/* ============================ FAQ ============================ */}
      <LandingFaq />

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
