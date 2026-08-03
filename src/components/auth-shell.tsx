import Link from 'next/link';
import { Logo } from './logo';

const HIGHLIGHTS = [
  'Live video, chalkboard, and chat in one room',
  'Buzzer rounds and a live points leaderboard',
  'Verifiable certificates when a course is done',
];

/**
 * Two-pane auth layout: a brand panel carrying the product's live-classroom
 * story on the left (desktop), the focused form on the right. No app header —
 * signing in is its own moment.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-neutral-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -left-20 top-1/3 h-[420px] w-[420px] rounded-full bg-signal-500/25 blur-[120px]"
          aria-hidden
        />
        <Link href="/" className="relative flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight">livetich</span>
        </Link>
        <div className="relative">
          <p className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em]">
            Teach skills <span className="text-signal-500">live</span>, to a room
            that actually shows up.
          </p>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3 text-neutral-300">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal-500 text-white">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
                    <path
                      d="m5 12.5 4.2 4.2L19 7"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-neutral-500">
          Live and interactive, not another passive video library.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 lg:hidden"
            aria-label="livetich home"
          >
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight text-neutral-950">
              livetich
            </span>
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-neutral-950">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
