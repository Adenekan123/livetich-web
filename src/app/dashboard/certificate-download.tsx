'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';

/** Authorized PDF download — needs the Bearer header, so a plain <a> won't do. */
export function CertificateDownload({
  certificateId,
  ready,
}: {
  certificateId: string;
  ready: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ready) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-neutral-600" role="status">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
        Generating PDF…
      </span>
    );
  }

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getRealtimeToken();
      const res = await fetch(`${API_URL}/certificates/${certificateId}/download`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('We could not download this certificate. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm font-semibold text-signal-700 transition hover:text-signal-800 disabled:opacity-50"
      >
        {busy && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {busy ? 'Downloading…' : 'Download PDF'}
      </button>
      {error && <p className="mt-1 max-w-48 text-xs text-rose-700" role="status">{error}</p>}
    </div>
  );
}
