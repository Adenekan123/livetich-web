'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PiMicrophone,
  PiRecordFill,
  PiStopFill,
  PiTrash,
  PiUploadSimple,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { btn, cn } from '@/lib/ui';

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Student attaches a recitation (or any audio/image/PDF) to an assignment —
 * either by recording in the browser or picking a file — and uploads it to the
 * authenticated API. On success the page refreshes so the new submission shows.
 */
export function AudioSubmit({
  assignmentId,
  existing,
}: {
  assignmentId: string;
  existing?: { fileUrl: string | null; fileMimeType: string | null } | null;
}) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [previewUrl],
  );

  function resetPicked() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
  }

  async function startRecording() {
    setError(null);
    resetPicked();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone unavailable or permission denied.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    resetPicked();
    setBlob(f);
    setPreviewUrl(f.type.startsWith('audio') ? URL.createObjectURL(f) : null);
  }

  async function upload() {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getRealtimeToken();
      const fd = new FormData();
      const name = blob instanceof File ? blob.name : 'recitation.webm';
      fd.append('file', blob, name);
      const res = await fetch(
        `${API_URL}/assignments/${assignmentId}/submissions/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token ?? ''}` },
          body: fd,
        },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(d.message || 'Upload failed');
      }
      resetPicked();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  const hasExistingAudio =
    existing?.fileUrl && existing.fileMimeType?.startsWith('audio');

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
        <PiMicrophone className="h-4 w-4" /> Recitation / file
      </p>

      {hasExistingAudio && !blob && (
        <div className="mt-2">
          <p className="text-xs text-neutral-400">Your current submission:</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={existing!.fileUrl!} className="mt-1 w-full" />
        </div>
      )}

      {/* Recorder / picker controls */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={busy}
            className={cn(btn('secondary', 'sm'))}
          >
            <PiRecordFill className="h-4 w-4 text-red-500" /> Record
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className={cn(btn('primary', 'sm'))}
          >
            <PiStopFill className="h-4 w-4" /> Stop · {mmss(seconds)}
          </button>
        )}

        <label className={cn(btn('secondary', 'sm'), 'cursor-pointer')}>
          <PiUploadSimple className="h-4 w-4" /> Choose file
          <input
            type="file"
            accept="audio/*,image/*,application/pdf"
            onChange={onPickFile}
            className="hidden"
          />
        </label>

        {recording && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording…
          </span>
        )}
      </div>

      {/* Preview + submit */}
      {blob && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-neutral-500">
              {blob instanceof File ? blob.name : `Recording · ${mmss(seconds)}`}
            </p>
            <button
              type="button"
              onClick={resetPicked}
              className="text-neutral-400 hover:text-red-600"
              aria-label="Discard"
            >
              <PiTrash className="h-4 w-4" />
            </button>
          </div>
          {previewUrl && (
            /* eslint-disable-next-line jsx-a11y/media-has-caption */
            <audio controls src={previewUrl} className="mt-2 w-full" />
          )}
          <button
            type="button"
            onClick={upload}
            disabled={busy}
            className={cn(btn('primary', 'sm'), 'mt-2 w-full justify-center')}
          >
            {busy ? 'Uploading…' : 'Submit this recording/file'}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
