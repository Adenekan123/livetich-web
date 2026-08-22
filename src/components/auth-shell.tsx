import Link from 'next/link';
import { BrandLogo } from './brand-logo';

/**
 * Live-room preview — a small, honest mock of what a session looks like, so the
 * brand panel sells the product instead of listing bullet points. Purely
 * decorative (aria-hidden); no real data.
 */
function LiveRoomPreview() {
  const seats = [
    { i: 'AO', c: 'bg-signal-500' },
    { i: 'KM', c: 'bg-amber-500' },
    { i: 'TB', c: 'bg-rose-500' },
    { i: 'JD', c: 'bg-sky-500' },
  ];
  const board = [
    { r: 1, n: 'Amara O.', p: 320 },
    { r: 2, n: 'Kojo M.', p: 285 },
    { r: 3, n: 'Tunde B.', p: 240 },
  ];
  return (
    <div
      className="mt-9 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-2xl shadow-black/30 backdrop-blur-sm"
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          Live now
        </span>
        <span className="font-mono text-[11px] text-white/40">32 in room</span>
      </div>

      <div className="mt-3.5 flex items-center">
        {seats.map((s, idx) => (
          <span
            key={s.i}
            className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-[#0f2e2a] ${s.c} ${idx > 0 ? '-ml-2' : ''}`}
          >
            {s.i}
          </span>
        ))}
        <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70 ring-2 ring-[#0f2e2a]">
          +28
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        {board.map((row) => (
          <div
            key={row.r}
            className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
          >
            <span className="font-mono text-[11px] font-bold text-lime-300">
              {row.r}
            </span>
            <span className="text-[13px] font-medium text-white/80">{row.n}</span>
            <span className="ml-auto text-[12px] font-semibold text-white/50">
              {row.p} pts
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-lime-400/10 px-3 py-2 ring-1 ring-inset ring-lime-400/25">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-lime-300" aria-hidden>
          <path
            d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-semibold text-lime-200">Buzzer round</span>
        <span className="ml-auto rounded-full bg-lime-400/20 px-2 py-0.5 text-[11px] font-bold text-lime-200">
          +25 pts
        </span>
      </div>
    </div>
  );
}

/**
 * Auth layout. Desktop keeps the dark, product-forward brand panel on the left.
 * The form pane is a clean light column — white ground, dark text, the dark
 * wordmark up top, no card or shadow — which is all the mobile screen shows
 * (the panel is desktop-only). Fields enlarge in mobile mode; see inputClassLg.
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
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-[46%] max-w-[600px] flex-col justify-between overflow-hidden bg-gradient-to-b from-[#0b2420] to-[#0f2e2a] p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -left-24 top-1/4 h-[440px] w-[440px] rounded-full bg-signal-500/20 blur-[130px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-0 h-[320px] w-[320px] rounded-full bg-lime-400/10 blur-[120px]"
          aria-hidden
        />

        <Link href="/" className="relative inline-flex">
          <BrandLogo onDark className="h-20 w-auto" />
        </Link>

        <div className="relative">
          <p className="max-w-md font-display text-[2rem] font-extrabold leading-[1.06] tracking-[-0.03em]">
            Teach skills <span className="text-lime-300">live</span>, to a room
            that actually shows up.
          </p>
          <LiveRoomPreview />
        </div>

        <p className="relative text-sm text-white/45">
          Live and interactive — not another passive video library.
        </p>
      </aside>

      {/* Form pane — light */}
      <main className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center sm:px-6 sm:py-14 lg:px-10">
        <div className="w-full max-w-[27rem]">
          {/* The dark wordmark only shows where the desktop side panel (which
              already carries the logo) is absent — i.e. below lg. */}
          <Link href="/" className="inline-flex lg:hidden" aria-label="livetich home">
            <BrandLogo className="h-20 w-auto sm:h-24" />
          </Link>
          <h1 className="mt-8 font-display text-[1.9rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-neutral-950 sm:text-[2.05rem] lg:mt-0">
            {title}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
            {subtitle}
          </p>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
