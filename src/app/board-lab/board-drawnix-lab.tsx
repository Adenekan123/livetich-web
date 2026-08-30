'use client';

// Plait/Drawnix spike — proves @plait-board/react-board mounts and is
// interactive under Next 16 + React 19 before we invest in the full chalkboard.
// This is a throwaway lab page, not wired into the live session yet.
// react-board's exports map blocks the /index.css subpath, so the stylesheet is
// vendored into the app (it's tiny and asset-free).
import '@/vendor/plait/react-board.css';
import { useState } from 'react';
import { Board, Wrapper, type BoardChangeData } from '@plait-board/react-board';
import type {
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitPlugin,
} from '@plait/core';
import { BoardTransforms, PlaitPointerType } from '@plait/core';
import { withDraw } from '@plait/draw';
import { withGroup, withImage, withText } from '@plait/common';

const PLUGINS: PlaitPlugin[] = [withDraw, withGroup, withImage, withText];
const OPTIONS: PlaitBoardOptions = { readonly: false, hideScrollbar: true };

export function BoardDrawnixLab() {
  const [value] = useState<PlaitElement[]>([]);
  const [board, setBoard] = useState<PlaitBoard | null>(null);
  const [changes, setChanges] = useState(0);
  const [vp, setVp] = useState(0);
  const [info, setInfo] = useState({ children: 0, zoom: 1 });

  const setTool = (p: PlaitPointerType) => {
    if (board) BoardTransforms.updatePointerType(board, p);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => setTool(PlaitPointerType.hand)}
          className="rounded bg-neutral-800 px-3 py-1 font-medium text-white"
        >
          Hand
        </button>
        <button
          onClick={() => setTool(PlaitPointerType.selection)}
          className="rounded bg-neutral-800 px-3 py-1 font-medium text-white"
        >
          Select
        </button>
        <span
          data-testid="readout"
          className="rounded bg-black px-2 py-1 font-mono text-xs text-white"
        >
          mounted:{board ? 'Y' : 'N'} changes:{changes} vp:{vp} children:
          {info.children} zoom:{info.zoom.toFixed(2)}
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-neutral-300 bg-white">
        <Wrapper
          value={value}
          options={OPTIONS}
          plugins={PLUGINS}
          onChange={(d: BoardChangeData) => {
            setChanges((c) => c + 1);
            setInfo({
              children: d.children.length,
              zoom: d.viewport?.zoom ?? 1,
            });
          }}
          onViewportChange={(v) => {
            setVp((n) => n + 1);
            setInfo((i) => ({ ...i, zoom: v?.zoom ?? i.zoom }));
          }}
        >
          <Board afterInit={(b) => setBoard(b)} />
        </Wrapper>
      </div>
    </div>
  );
}
