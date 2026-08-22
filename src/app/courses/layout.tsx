import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentUser } from '@/lib/auth';

/** Wraps the programs catalog + all course sub-pages in the sidebar shell. */
export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
