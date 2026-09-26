import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BroadcastRings } from '@/components/broadcast-rings';
import { Wordmark } from '@/components/logo';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { btn } from '@/lib/ui';
import { JoinPanel } from './join-panel';

/**
 * The class link: one URL a cohort keeps.
 *
 * Every other way into a live class needs you to know something first — which
 * session is today, or where the program page is. This one does not. It is the
 * link an instructor pins in the class group in week one and never sends
 * again: it renders for a stranger, says whether class is on right now, and
 * resolves to today's room when you press Join.
 *
 * There is no session id in the URL on purpose. Sessions are materialised on
 * first entry, so today's does not exist until someone walks in — a link built
 * on a session id would be dead every morning until the first person arrived,
 * and different every week. The cohort is the durable thing, so the cohort is
 * the link.
 */

interface ClassCard {
  courseId: string;
  courseTitle: string;
  programTitle: string | null;
  organizationName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  timezone: string | null;
  joinableNow: boolean;
  isLive: boolean;
  nextAt: string | null;
}

async function loadCard(courseId: string): Promise<ClassCard | null> {
  try {
    return await api<ClassCard>(`/sessions/course/${courseId}/describe`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await props.params;
  const card = await loadCard(courseId).catch(() => null);
  if (!card) return { title: 'Class' };
  const name = [card.programTitle, card.courseTitle].filter(Boolean).join(' — ');
  return {
    title: name,
    description: card.organizationName
      ? `Live class with ${card.organizationName} on livetich.`
      : 'Live class on livetich.',
  };
}

/** The cohort's own words for when it next meets. */
function formatNext(nextAt: string | null, timezone: string | null): string | null {
  if (!nextAt) return null;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  // A stray timezone string ("GMT+1") makes toLocaleString throw, which would
  // take the whole page down for everyone holding the link.
  try {
    return new Date(nextAt).toLocaleString(undefined, {
      ...opts,
      timeZone: timezone ?? undefined,
    });
  } catch {
    try {
      return new Date(nextAt).toLocaleString(undefined, opts);
    } catch {
      return null;
    }
  }
}

export default async function ClassLinkPage(props: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await props.params;
  const [card, user] = await Promise.all([
    loadCard(courseId),
    getCurrentUser().catch(() => null),
  ]);
  if (!card) notFound();

  const when = formatNext(card.nextAt, card.timezone);
  const title = card.programTitle ?? card.courseTitle;
  const subtitle = card.programTitle ? card.courseTitle : null;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-white">
      <BroadcastRings origin="edge" scrim={false} />

      <div className="relative mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-8">
        <Wordmark className="h-7 text-neutral-950" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="max-w-xl">
          {card.isLive ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-600" />
              Live now
            </span>
          ) : card.joinableNow ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-800 ring-1 ring-accent-200">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
              Room open — your instructor hasn&apos;t arrived yet
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700 ring-1 ring-signal-200">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-600" />
              {when ? `Next class ${when}` : 'No class scheduled right now'}
            </span>
          )}

          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 font-display text-xl font-semibold text-neutral-500">
              {subtitle}
            </p>
          )}
          {card.organizationName && (
            <p className="mt-3 text-sm text-neutral-500">
              with {card.organizationName}
            </p>
          )}

          <div className="mt-8 border-t border-neutral-200 pt-8">
            {user ? (
              <JoinPanel
                courseId={courseId}
                joinableNow={card.joinableNow}
                isLive={card.isLive}
                when={when}
                name={user.name}
              />
            ) : (
              <div>
                <p className="text-sm text-neutral-600">
                  Sign in to join. You&apos;ll come straight back here.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/c/${courseId}`)}`}
                  className={btn('primary', 'xl', 'mt-4 w-full sm:w-auto')}
                >
                  Sign in to join
                </Link>
                <p className="mt-4 text-sm text-neutral-500">
                  Have a class shortcut with a six-digit code? Open that link
                  instead — it signs you in and lists today&apos;s classes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
