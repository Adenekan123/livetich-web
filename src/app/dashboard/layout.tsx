import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentUser } from '@/lib/auth';

/** Wraps the dashboard in the persistent sidebar shell. */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
