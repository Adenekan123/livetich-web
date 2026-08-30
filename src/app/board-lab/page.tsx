'use client';

import dynamic from 'next/dynamic';

// Plait touches browser-only APIs, so the board is client-only (mirrors the
// tldraw board's dynamic ssr:false import).
const BoardDrawnixLab = dynamic(
  () => import('./board-drawnix-lab').then((m) => m.BoardDrawnixLab),
  {
    ssr: false,
    loading: () => <div style={{ padding: 16 }}>Loading board…</div>,
  },
);

export default function BoardLabPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, padding: 16, background: '#f3f4f6' }}>
      <BoardDrawnixLab />
    </div>
  );
}
