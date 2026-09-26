import { notFound } from 'next/navigation';
import { api } from '@/lib/api';

export const metadata = { title: 'Recording - livetich' };

interface SharedRecording {
  title: string;
  workspace: string;
  recordedAt: string;
  durationSec: number | null;
  url: string | null;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/**
 * A shared recording, open to anyone holding the link.
 *
 * No sign-in: the token is the credential, which is why it is long, can carry
 * an expiry, and can be withdrawn from the gallery. Nothing here reveals the
 * rest of the workspace.
 */
export default async function WatchPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const recording = await api<SharedRecording>(`/shared-recordings/${token}`).catch(
    () => null,
  );
  if (!recording?.url) notFound();

  const length = formatDuration(recording.durationSec);

  return (
    <main className="min-h-dvh bg-neutral-950 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-4">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
            {recording.workspace}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white">
            {recording.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Recorded {new Date(recording.recordedAt).toLocaleDateString()}
            {length ? ` · ${length}` : ''}
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl bg-black shadow-2xl">
          {/* Streams from the object store directly — this app never proxies it. */}
          <video src={recording.url} controls className="h-auto w-full" />
        </div>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Shared with you by {recording.workspace}. The link may stop working if
          it is withdrawn or expires.
        </p>
      </div>
    </main>
  );
}
