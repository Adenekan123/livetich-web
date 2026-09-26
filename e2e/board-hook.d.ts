import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/**
 * The board exposes its Excalidraw API on the window for the end-to-end specs.
 * Excalidraw renders to a canvas rather than to DOM nodes, so "what is on the
 * board" cannot be queried with a selector the way tldraw's `.tl-shape` allowed
 * — the specs read the live scene through this handle instead.
 */
declare global {
  interface Window {
    __livetichBoard?: ExcalidrawImperativeAPI | null;
  }
}

export {};
