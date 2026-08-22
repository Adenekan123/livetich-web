import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  PiArrowRightBold,
  PiCheckBold,
  PiCodeBold,
  PiExamBold,
  PiMoonStarsBold,
  PiPuzzlePieceBold,
  PiSlidersHorizontalBold,
} from 'react-icons/pi';
import { getCurrentUser } from '@/lib/auth';
import { cardClass, cn } from '@/lib/ui';

export const metadata = { title: 'Plugins — livetich' };

/*
 * DESIGN-ONLY plugin store. The pack catalog ships in application code (see the
 * API's `src/plugins/catalog.ts`); this page mirrors those real entries as a
 * static list so the marketplace can be laid out without any data fetching.
 * The dedicated Add-ons page (/account/add-ons) is where a pack is actually
 * turned on — the "Get pack" buttons here are intentionally non-functional and
 * carry a quiet "Coming soon" affordance.
 */

type StorePlugin = {
  key: string;
  name: string;
  summary: string;
  features: string[];
  priceMonthly: number | null;
  icon: IconType;
};

const PLUGINS: readonly StorePlugin[] = [
  {
    key: 'islamic-education',
    name: 'Islamic Education',
    summary:
      'Tools for Qur’an, tajweed, and Arabic instructors — RTL classroom, ' +
      'memorization (hifz) tracking, and tajweed-aware assessment.',
    features: [
      'Right-to-left / Arabic classroom mode',
      'Hifz (memorization) tracking per student',
      'Tajweed-aware assessment templates',
      'Ijazah-style certificate template',
    ],
    priceMonthly: null,
    icon: PiMoonStarsBold,
  },
  {
    key: 'code-instruction',
    name: 'Code Instruction',
    summary:
      'Tools for programming instructors — a live, syntax-highlighted code ' +
      'board the class follows in real time, with per-language editing.',
    features: [
      'Live shared code editor as a classroom surface',
      'Syntax highlighting across common languages',
      'Instructor drives; students follow read-only',
    ],
    priceMonthly: null,
    icon: PiCodeBold,
  },
  {
    key: 'test-prep',
    name: 'Test Prep',
    summary:
      'Tools for exam-coaching instructors (JAMB, WAEC, NECO, Post-UTME) — ' +
      'a question bank, timed mock exams that auto-score, and per-topic ' +
      'performance analytics.',
    features: [
      'Author timed mock exams from a question bank',
      'Students sit exams against the clock; auto-scored on submit',
      'Per-topic breakdown to spot weak areas',
    ],
    priceMonthly: null,
    icon: PiExamBold,
  },
];

export default async function PluginsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ORG_ADMIN') redirect('/account');

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Account
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-950">
            Plugins
          </h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Packs of tools built for your teaching niche. Browse what’s
            available, then turn packs on for your workspace from Add-ons.
          </p>
        </div>
        <Link
          href="/account/add-ons"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-signal-600 hover:text-signal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:ring-offset-2"
        >
          <PiSlidersHorizontalBold className="h-4 w-4" />
          Manage enabled add-ons
        </Link>
      </div>

      {/* Pilot notice */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-signal-200 bg-signal-50 px-4 py-3 sm:px-5">
        <PiPuzzlePieceBold className="mt-0.5 h-5 w-5 shrink-0 text-signal-700" aria-hidden />
        <p className="text-sm text-signal-800">
          Every pack is <span className="font-semibold">free during the pilot</span>.
          Prices below are indicative of what packs will cost after the pilot.
        </p>
      </div>

      {/* Store grid */}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLUGINS.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.key} className={cn(cardClass, 'flex flex-col p-5 sm:p-6')}>
              <div className="flex items-start gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal-50 text-signal-700"
                  aria-hidden
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-neutral-900">{p.name}</h2>
                  <p className="mt-0.5 text-xs font-medium text-neutral-400">
                    {p.priceMonthly === null
                      ? 'Free during the pilot'
                      : `$${p.priceMonthly}/month after the pilot`}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-neutral-500">{p.summary}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-600">
                    <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Coming soon"
                  className="inline-flex min-h-[44px] flex-1 select-none items-center justify-center gap-2 rounded-full bg-signal-700 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
                >
                  Get pack
                  <PiArrowRightBold className="h-4 w-4" />
                </button>
                <span className="shrink-0 text-xs font-medium text-neutral-400">
                  Coming soon
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
