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
  if (!ready) {
    return (
      <span className="flex items-center gap-1.5 text-neutral-400">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
        Generating PDF…
      </span>
    );
  }

  const download = async () => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={busy}
      className="flex items-center gap-1.5 text-signal-600 transition hover:text-signal-500 disabled:opacity-50"
    >
      {busy && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {busy ? 'Downloading…' : 'Download PDF'}
    </button>
  );
}
