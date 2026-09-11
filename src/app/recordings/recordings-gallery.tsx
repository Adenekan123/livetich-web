'use client';

import { useState, useTransition } from 'react';
import {
  PiCheckBold,
  PiDownloadSimpleBold,
  PiLinkSimpleBold,
  PiLinkBreakBold,
  PiPlayBold,
  PiTrashBold,
  PiWarningBold,
} from 'react-icons/pi';
import {
  deleteRecording,
  recordingDownloadUrl,
  recordingPlaybackUrl,
  shareRecording,
  unshareRecording,
  type RecordingSummary,
  type StorageUsage,
} from '@/app/actions/recordings';
import { btn, cardClass, cn } from '@/lib/ui';

/** Bytes in the unit a person would say out loud. */
function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<RecordingSummary['status'], string> = {
  STARTING: 'Starting…',
  RECORDING: 'Recording',
  PROCESSING: 'Processing…',
  READY: 'Ready',
  FAILED: 'Failed',
};

export function RecordingsGallery({
  usage,
  recordings,
}: {
  usage: StorageUsage;
  recordings: RecordingSummary[];
}) {
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {usage.quotaBytes !== null && (
        <StorageBar usage={usage} />
      )}

      {message && (
        <p className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          {message}
        </p>
      )}

      <ul className="space-y-3">
        {recordings.map((r) => (
          <RecordingRow
            key={r.id}
            recording={r}
            onPlay={(url) => setPlaying({ id: r.id, url })}
            onMessage={setMessage}
          />
        ))}
      </ul>

      {playing && (
        <div
          className="fixed inset-0 z-[600] grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Streams straight from the object store; this app never proxies it. */}
            <video src={playing.url} controls autoPlay className="h-auto w-full" />
          </div>
          <button
            type="button"
            onClick={() => setPlaying(null)}
            className="mt-3 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-neutral-800"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function StorageBar({ usage }: { usage: StorageUsage }) {
  const quota = usage.quotaBytes ?? 0;
  const pct = quota > 0 ? Math.min(100, (usage.usedBytes / quota) * 100) : 0;
  return (
    <div className={cn(cardClass, 'p-4')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
          Storage
        </p>
        <p className="text-sm text-neutral-600">
          {formatBytes(usage.usedBytes)} of {formatBytes(quota)}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            usage.full
              ? 'bg-red-600'
              : usage.nearLimit
                ? 'bg-amber-500'
                : 'bg-signal-600',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(usage.nearLimit || usage.full) && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs font-semibold',
            usage.full ? 'text-red-600' : 'text-amber-700',
          )}
        >
          <PiWarningBold aria-hidden />
          {usage.full
            ? 'Storage is full — delete a recording before starting another.'
            : 'Storage is nearly full.'}
        </p>
      )}
    </div>
  );
}

function RecordingRow({
  recording,
  onPlay,
  onMessage,
}: {
  recording: RecordingSummary;
  onPlay: (url: string) => void;
  onMessage: (m: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [shareToken, setShareToken] = useState(recording.shareToken);
  const ready = recording.status === 'READY';

  const shareUrl = shareToken
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/watch/${shareToken}`
    : null;

  return (
    <li className={cn(cardClass, 'p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">
            {recording.course.title}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {new Date(recording.createdAt).toLocaleString()} ·{' '}
            {formatDuration(recording.durationSec)} ·{' '}
            {formatBytes(recording.sizeBytes)} · {recording.startedBy.name}
          </p>
          {recording.status !== 'READY' && (
            <p
              className={cn(
                'mt-1 text-xs font-semibold',
                recording.status === 'FAILED' ? 'text-red-600' : 'text-neutral-500',
              )}
            >
              {STATUS_LABEL[recording.status]}
              {recording.error ? ` — ${recording.error}` : ''}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!ready || pending}
            onClick={() =>
              start(async () => {
                const { url, error } = await recordingPlaybackUrl(recording.id);
                if (url) onPlay(url);
                else onMessage(error ?? 'That recording is not available yet.');
              })
            }
            className={cn(btn('primary', 'sm'), !ready && 'cursor-not-allowed opacity-40')}
          >
            <span className="flex items-center gap-1.5">
              <PiPlayBold aria-hidden />
              Play
            </span>
          </button>

          <button
            type="button"
            disabled={!ready || pending}
            onClick={() =>
              start(async () => {
                const { url, error } = await recordingDownloadUrl(recording.id);
                if (url) window.open(url, '_blank', 'noopener');
                else onMessage(error ?? 'That download is not available yet.');
              })
            }
            className={cn(btn('ghost', 'sm'), !ready && 'cursor-not-allowed opacity-40')}
            title="Download"
            aria-label="Download"
          >
            <PiDownloadSimpleBold aria-hidden />
          </button>

          <button
            type="button"
            disabled={!ready || pending}
            onClick={() =>
              start(async () => {
                if (shareToken) {
                  const res = await unshareRecording(recording.id);
                  if (res.error) onMessage(res.error);
                  else {
                    setShareToken(null);
                    onMessage('Share link withdrawn.');
                  }
                  return;
                }
                const res = await shareRecording(recording.id, null);
                if (res.error) onMessage(res.error);
                else {
                  setShareToken(res.shareToken);
                  const url = `${window.location.origin}/watch/${res.shareToken}`;
                  await navigator.clipboard?.writeText(url).catch(() => {});
                  onMessage(`Share link copied — ${url}`);
                }
              })
            }
            className={cn(
              btn('ghost', 'sm'),
              !ready && 'cursor-not-allowed opacity-40',
              shareToken && 'text-signal-700',
            )}
            title={shareToken ? 'Withdraw share link' : 'Create a share link'}
            aria-label={shareToken ? 'Withdraw share link' : 'Create a share link'}
          >
            {shareToken ? <PiLinkBreakBold aria-hidden /> : <PiLinkSimpleBold aria-hidden />}
          </button>

          {confirming ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteRecording(recording.id);
                    if (res.error) onMessage(res.error);
                    setConfirming(false);
                  })
                }
                className={cn(btn('danger', 'sm'))}
              >
                <span className="flex items-center gap-1.5">
                  <PiCheckBold aria-hidden />
                  Delete for good
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={cn(btn('ghost', 'sm'))}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className={cn(btn('ghost', 'sm'), 'text-neutral-500 hover:text-red-600')}
              title="Delete"
              aria-label="Delete"
            >
              <PiTrashBold aria-hidden />
            </button>
          )}
        </div>
      </div>

      {shareUrl && (
        <p className="mt-2 truncate rounded-lg bg-neutral-50 px-2.5 py-1.5 font-mono text-[11px] text-neutral-600">
          {shareUrl}
        </p>
      )}
    </li>
  );
}
