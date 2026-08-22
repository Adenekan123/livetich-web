import Link from 'next/link';
import type { Metadata } from 'next';
import {
  PiSealCheckFill,
  PiWarningCircleFill,
  PiPlugsConnectedFill,
} from 'react-icons/pi';
import { api, ApiError } from '@/lib/api';
import { cardClass, cn } from '@/lib/ui';

export const metadata: Metadata = {
  title: 'Verify certificate — livetich',
  description: 'Confirm the authenticity of a livetich certificate of completion.',
};

/** Shape of the PUBLIC GET /certificates/verify/:code response. */
interface CertificateVerification {
  valid: true;
  verificationCode: string;
  student: string;
  course: string;
  instructor: string;
  issuedAt: string;
}

function formatIssued(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Public certificate-verification page — the target of the QR code / link
 * printed on every certificate PDF (CERT_VERIFY_BASE resolves here). Viewed by
 * outsiders who may never have signed in, so it renders as a self-contained,
 * presentable page rather than relying on the authenticated app shell.
 */
export default async function VerifyCertificatePage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;

  let cert: CertificateVerification | null = null;
  let unreachable = false;
  try {
    cert = await api<CertificateVerification>(
      `/certificates/verify/${encodeURIComponent(code)}`,
    );
  } catch (err) {
    // A 404 is the expected "unknown code" case; anything else (0 = network,
    // 5xx) means we could not check, which we must not report as "invalid".
    if (err instanceof ApiError && err.status === 404) {
      cert = null;
    } else {
      unreachable = true;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-signal-50 via-white to-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-signal-700 hover:text-signal-800"
          >
            livetich
          </Link>
          <p className="mt-1 text-sm text-neutral-500">Certificate verification</p>
        </div>

        {unreachable ? (
          <StatusCard
            tone="warn"
            icon={<PiPlugsConnectedFill aria-hidden />}
            heading="Couldn’t verify right now"
            message="We couldn’t reach the certificate service to check this code. Please try again in a moment."
          />
        ) : cert ? (
          <ValidCard cert={cert} />
        ) : (
          <StatusCard
            tone="error"
            icon={<PiWarningCircleFill aria-hidden />}
            heading="Certificate not found"
            message="No certificate matches this code. If you scanned a printed certificate, check that the code was captured in full."
          >
            <p className="mt-4 break-all rounded-lg bg-neutral-50 px-3 py-2 text-center font-mono text-xs text-neutral-500">
              {code}
            </p>
          </StatusCard>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          Certificates are issued through livetich. Verification confirms a record
          exists for this code.
        </p>
      </div>
    </main>
  );
}

function ValidCard({ cert }: { cert: CertificateVerification }) {
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <div className="flex flex-col items-center gap-2 border-b border-neutral-100 bg-emerald-50/60 px-6 py-7 text-center">
        <PiSealCheckFill className="text-4xl text-emerald-600" aria-hidden />
        <h1 className="font-display text-xl font-bold text-emerald-800">
          Verified
        </h1>
        <p className="text-sm text-emerald-700">
          This is a genuine certificate of completion.
        </p>
      </div>
      <dl className="divide-y divide-neutral-100 px-6 py-2">
        <Detail label="Student" value={cert.student} />
        <Detail label="Course" value={cert.course} />
        <Detail label="Instructor" value={cert.instructor} />
        <Detail label="Issued" value={formatIssued(cert.issuedAt)} />
      </dl>
      <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3 text-center">
        <span className="text-xs text-neutral-400">Verification code</span>
        <p className="mt-0.5 break-all font-mono text-xs text-neutral-600">
          {cert.verificationCode}
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-sm text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900 sm:text-right">{value}</dd>
    </div>
  );
}

function StatusCard({
  tone,
  icon,
  heading,
  message,
  children,
}: {
  tone: 'error' | 'warn';
  icon: React.ReactNode;
  heading: string;
  message: string;
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'bg-rose-50/60 text-rose-600'
      : 'bg-amber-50/60 text-amber-600';
  return (
    <div className={cn(cardClass, 'px-6 py-8 text-center')}>
      <div
        className={cn(
          'mx-auto flex h-14 w-14 items-center justify-center rounded-full text-3xl',
          toneClass,
        )}
      >
        {icon}
      </div>
      <h1 className="mt-4 font-display text-lg font-bold text-neutral-900">
        {heading}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">{message}</p>
      {children}
    </div>
  );
}
