import type { Page } from '@playwright/test';

/**
 * Locate an Excalidraw tool button.
 *
 * The `data-testid` lives on a visually-hidden `<input type="radio">` that
 * carries `pointer-events: none` — clicking it directly always times out. The
 * clickable element is the `<label>` wrapping it, which is what this returns.
 *
 * Tool names are Excalidraw's own element types: selection, rectangle, diamond,
 * ellipse, arrow, line, freedraw, text, image, eraser, hand, laser, frame.
 */
export const tool = (page: Page, name: string) =>
  page.locator(`label:has(> input[data-testid="toolbar-${name}"])`);
