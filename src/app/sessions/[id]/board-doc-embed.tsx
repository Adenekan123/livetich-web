'use client';

import { PiArrowSquareOutBold } from 'react-icons/pi';
import type { GoogleEmbed } from './board-docs';

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
 */
export function BoardDocEmbed({
  embed,
  link,
}: {
  embed: GoogleEmbed;
  /** The original pasted URL — where "open" should lead. */
  link: string;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white">
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
      <iframe
        src={embed.src}
        title={embed.label}
        className="min-h-0 flex-1 border-0"
        allow="autoplay"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
