'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

export interface RecordingSummary {
  id: string;
  status: 'STARTING' | 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED';
  sizeBytes: number | null;
  durationSec: number | null;
  error: string | null;
  createdAt: string;
  readyAt: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  course: { id: string; title: string };
  startedBy: { id: string; name: string };
  session: { id: string; scheduledAt: string };
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number | null;
  nearLimit: boolean;
  full: boolean;
}

export interface RecordingsPayload {
  usage: StorageUsage;
  recordings: RecordingSummary[];
}

export interface RecordingActionState {
  error: string | null;
  ok?: boolean;
}

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

export async function listRecordings(): Promise<RecordingsPayload> {
  const token = await tokenOrLogin();
  return api<RecordingsPayload>('/recordings', { token });
}

/**
 * A short-lived URL straight to the object store. Fetched on demand rather than
 * with the list: these expire, and minting one per row on every page view would
 * sign links nobody opens.
 */
export async function recordingPlaybackUrl(
  id: string,
): Promise<{ url: string | null; error: string | null }> {
  const token = await tokenOrLogin();
  try {
    const res = await api<{ url: string | null }>(`/recordings/${id}/playback`, {
      token,
    });
    return { url: res.url, error: null };
  } catch (e) {
    return {
      url: null,
      error: e instanceof ApiError ? e.message : 'Could not open that recording',
    };
  }
}

export async function recordingDownloadUrl(
  id: string,
): Promise<{ url: string | null; error: string | null }> {
  const token = await tokenOrLogin();
  try {
    const res = await api<{ url: string | null }>(`/recordings/${id}/download`, {
      token,
    });
    return { url: res.url, error: null };
  } catch (e) {
    return {
      url: null,
      error: e instanceof ApiError ? e.message : 'Could not prepare that download',
    };
  }
}

export async function shareRecording(
  id: string,
  expiresInDays: number | null,
): Promise<{ shareToken: string | null; error: string | null }> {
  const token = await tokenOrLogin();
  try {
    const res = await api<{ shareToken: string }>(`/recordings/${id}/share`, {
      method: 'POST',
      token,
      body: expiresInDays == null ? {} : { expiresInDays },
    });
    revalidatePath('/recordings');
    return { shareToken: res.shareToken, error: null };
  } catch (e) {
    return {
      shareToken: null,
      error: e instanceof ApiError ? e.message : 'Could not create a link',
    };
  }
}

export async function unshareRecording(id: string): Promise<RecordingActionState> {
  const token = await tokenOrLogin();
  try {
    await api(`/recordings/${id}/unshare`, { method: 'POST', token });
    revalidatePath('/recordings');
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : 'Could not withdraw that link',
    };
  }
}

export async function deleteRecording(id: string): Promise<RecordingActionState> {
  const token = await tokenOrLogin();
  try {
    await api(`/recordings/${id}`, { method: 'DELETE', token });
    revalidatePath('/recordings');
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : 'Could not delete that recording',
    };
  }
}

export interface SessionRecordingState {
  /** False when LiveKit or the bucket is not configured — the button hides. */
  available: boolean;
  /** False when this instructor has no live microphone in the room. */
  micLive: boolean;
  /** Non-null only while a recording is actually running. */
  recording: { id: string; status: string; createdAt: string } | null;
  last: { id: string; status: string; error: string | null } | null;
}

/** What the classroom's Record control should show. */
export async function sessionRecordingState(
  sessionId: string,
): Promise<SessionRecordingState> {
  const token = await tokenOrLogin();
  return api<SessionRecordingState>(`/sessions/${sessionId}/recording`, { token });
}

export async function startSessionRecording(
  sessionId: string,
): Promise<RecordingActionState> {
  const token = await tokenOrLogin();
  try {
    // Starting is slow by nature: the API first checks the recorder page is
    // served (allowed 15s), then waits for LiveKit to accept the egress. The
    // default 10s gave up mid-way and reported a working API as unreachable.
    await api(`/sessions/${sessionId}/recording/start`, {
      method: 'POST',
      token,
      timeoutMs: 45_000,
    });
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : 'Could not start recording',
    };
  }
}

export async function stopSessionRecording(
  sessionId: string,
): Promise<RecordingActionState> {
  const token = await tokenOrLogin();
  try {
    await api(`/sessions/${sessionId}/recording/stop`, { method: 'POST', token });
    revalidatePath('/recordings');
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : 'Could not stop recording',
    };
  }
}
