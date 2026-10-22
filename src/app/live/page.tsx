import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { LiveSession } from '@/lib/types';

export default async function LiveIndexPage() {
  const token = await getToken();
  if (!token) redirect('/login');

  try {
    const sessions = await api<LiveSession[]>('/sessions/browse', { token });
    const active = sessions.find((s) => s.status === 'LIVE');
    if (active) {
      redirect(`/sessions/${active.id}`);
    }
  } catch {}

  redirect('/dashboard');
}
