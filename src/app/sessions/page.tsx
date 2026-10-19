import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { LiveSession } from '@/lib/types';

export default async function SessionsIndexPage() {
  const token = await getToken();
  if (!token) redirect('/login');

  try {
    // Check if there is an active live session
    const sessions = await api<LiveSession[]>('/sessions/browse', { token });
    const active = sessions.find((s) => s.status === 'LIVE');
    if (active) {
      redirect(`/sessions/${active.id}`);
    }
  } catch (e) {
    // If browse fails, fallback to dashboard
  }

  redirect('/dashboard');
}
