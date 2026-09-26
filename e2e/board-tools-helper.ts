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
 *
 * Not all of them are reachable. `rectangle`, `diamond` and `ellipse` are
 * `display: none` in board-excalidraw.css — those shapes moved into the app's
 * own shapes menu so each has a single home. The locator still resolves (the
 * node is in the DOM) but its box is 0x0, so the click waits forever rather
 * than failing. Drive the menu instead:
 *
 *   await page.locator('[data-board-shapes] button').click();
 *   await page.getByRole('menuitem', { name: 'Square' }).click();
 */
export const tool = (page: Page, name: string) =>
  page.locator(`label:has(> input[data-testid="toolbar-${name}"])`);
