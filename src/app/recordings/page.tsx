import { redirect } from 'next/navigation';
import { PiVideoCameraSlashBold } from 'react-icons/pi';
import { listRecordings } from '@/app/actions/recordings';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentUser } from '@/lib/auth';
import { RecordingsGallery } from './recordings-gallery';

export const metadata = { title: 'Recordings - livetich' };

/**
 * The workspace's recorded classes.
 *
 * Staff only — a recording holds students' faces and voices, so it is not
 * listed to the class. Students reach one through a share link an instructor
 * has deliberately created.
 */
export default async function RecordingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/login');
  if (user.role !== 'INSTRUCTOR' && user.role !== 'ORG_ADMIN') {
    redirect('/dashboard');
  }

  const { usage, recordings } = await listRecordings().catch(() => ({
    usage: { usedBytes: 0, quotaBytes: null, nearLimit: false, full: false },
    recordings: [],
  }));

  return (
    <DashboardShell user={user}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-900">
            Recordings
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Classes recorded in this workspace. Only staff can see this list —
            share a link to let students watch one.
          </p>
        </header>

        {recordings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
            <PiVideoCameraSlashBold
              className="mx-auto h-8 w-8 text-neutral-300"
              aria-hidden
            />
            <p className="mt-3 font-semibold text-neutral-700">No recordings yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Start one from the classroom while a class is live. It appears here
              a moment after you stop.
            </p>
          </div>
        ) : (
          <RecordingsGallery usage={usage} recordings={recordings} />
        )}
      </div>
    </DashboardShell>
  );
}
