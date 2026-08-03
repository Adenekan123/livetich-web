import Link from 'next/link';
import { Logo } from '@/components/logo';

/** Simple centered reading shell for the legal pages (public, no auth). */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-neutral-950">
              livetich
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-neutral-500">
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-neutral-900">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Draft template — review with legal counsel and fill in the{' '}
          <span className="font-mono">[bracketed]</span> details before relying on
          it.
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-neutral-950">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated: {updated}</p>
        <div className="prose-legal mt-8 space-y-6 text-[15px] leading-relaxed text-neutral-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-neutral-950 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}
