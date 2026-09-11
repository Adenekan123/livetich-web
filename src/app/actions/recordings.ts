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
