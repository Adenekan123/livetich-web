'use client';

import { useEffect, useRef, useState } from 'react';
import { PiArrowSquareOutBold } from 'react-icons/pi';
import type { GoogleEmbed } from './board-docs';

/**
 * How long the zoom must hold still before the frame is re-rendered at the new
 * scale. Resizing an iframe makes the document inside it reflow, and doing that
 * on every step of a pinch or a scroll-wheel zoom is worse than a moment of
 * softness.
 */
const ZOOM_SETTLE_MS = 180;

/**
 * A Google file on the board.
 *
 * The frame is Google's read-only viewer. It can come back empty — if the file
 * is not shared with "anyone with the link", Google serves a sign-in wall
 * instead, and being cross-origin we cannot see that happen or report it.
 *
 * So the bar above the frame is not decoration. It names what this is, and
 * carries the way out: if the frame is blank in front of a class, the
 * instructor can open the real file in a tab rather than being stuck looking at
 * a white rectangle with no explanation.
 *
 * ## Why the frame counter-scales
 *
 * Excalidraw puts embeds inside a container it scales with the board's zoom, so
 * an iframe laid out at 558px and shown at 70% is rendered at 558px and then
 * squashed to 391 — the browser rasterises the document and resamples it, which
 * is what made the text look soft.
 *
 * A transform cannot be undone by a parent, but it can be cancelled: lay the
 * iframe out at the size it will actually occupy (box x zoom) and scale it back
 * up by 1/zoom. The two scales multiply to 1, so the document renders at its
 * final pixel size and is never resampled.
 */
export function BoardDocEmbed({
  embed,
  link,
  zoom,
}: {
  embed: GoogleEmbed;
  /** The original pasted URL — where "open" should lead. */
  link: string;
  /** The board's current zoom, from Excalidraw's appState. */
  zoom: number;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [settledZoom, setSettledZoom] = useState(zoom);

  // The layout size of the area the frame fills, before the board's transform.
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const measure = () => setBox({ w: holder.offsetWidth, h: holder.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(holder);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSettledZoom(zoom), ZOOM_SETTLE_MS);
    return () => clearTimeout(t);
  }, [zoom]);

  const z = settledZoom > 0 ? settledZoom : 1;

  return (
    <div
      data-doc-embed={embed.kind}
      className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
        <span className="truncate text-[11px] font-semibold text-neutral-700">
          {embed.label}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-neutral-500">
          read-only
        </span>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google"
          className="shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
        >
          <PiArrowSquareOutBold className="h-3.5 w-3.5" />
        </a>
      </div>
      <div ref={holderRef} className="min-h-0 flex-1 overflow-hidden">
        {box && (
          <iframe
            src={embed.src}
            title={embed.label}
            className="border-0"
            style={{
              width: box.w * z,
              height: box.h * z,
              transform: `scale(${1 / z})`,
              transformOrigin: 'top left',
            }}
            allow="autoplay"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}
