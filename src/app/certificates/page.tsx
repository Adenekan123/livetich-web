import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PiCertificateBold } from 'react-icons/pi';
import { DashboardShell } from '@/components/dashboard-shell';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { Certificate } from '@/lib/types';
import { btn, cardClass, cn } from '@/lib/ui';
import { CertificateDownload } from '../dashboard/certificate-download';

export const metadata: Metadata = { title: 'Certificates — livetich' };

/**
 * The student's certificates, the target of the sidebar "Certificates" link.
 * Only a page (no layout) lives under /certificates so the public
 * /certificates/verify/[code] route stays outside the authenticated shell.
 */
export default async function CertificatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = await getToken();

  let certificates: Certificate[] = [];
  try {
    certificates = await api<Certificate[]>('/certificates/mine', { token });
  } catch {
    // API hiccup — fall back to the empty state rather than crashing the page.
    certificates = [];
  }

  return (
    <DashboardShell user={user}>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Certificates
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every program you complete earns a verifiable certificate. Download
            the PDF or share its verification code.
          </p>
        </header>

        {certificates.length === 0 ? (
          <div
            className={cn(
              cardClass,
              'flex flex-col items-center gap-3 px-6 py-12 text-center',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-100 to-white text-accent-700">
              <PiCertificateBold className="h-6 w-6" />
            </span>
            <p className="text-[15px] font-semibold text-neutral-800">
              No certificates yet
            </p>
            <p className="max-w-sm text-sm text-neutral-500">
              Finish a program to earn a verifiable certificate — it&apos;ll
              appear here and on your dashboard.
            </p>
            <Link href="/courses" className={btn('secondary', 'sm', 'mt-1')}>
              Browse the catalog
            </Link>
          </div>
        ) : (
          <div className={cn(cardClass, 'divide-y divide-neutral-100 p-2 sm:p-3')}>
            {certificates.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent-100 bg-gradient-to-br from-accent-100 to-white text-accent-700">
                  <PiCertificateBold className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-neutral-950">
                    {c.course?.title ?? 'Certificate'}
                  </p>
                  <p className="truncate font-mono text-[13px] text-neutral-500">
                    {c.verificationCode} ·{' '}
                    {new Date(c.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                <CertificateDownload
                  certificateId={c.id}
                  ready={Boolean(c.pdfUrl)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
