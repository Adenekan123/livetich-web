/**
 * LaTeX on the whiteboard.
 *
 * Excalidraw draws to a canvas, so anything on the board has to be one of its
 * element types — there is nowhere for live DOM to live. KaTeX only emits HTML
 * or MathML (it has no SVG output mode), and an SVG carrying that HTML in a
 * `<foreignObject>` is not reliably rendered when the SVG is loaded as an
 * image. So the formula is rasterised once, at high DPI, and placed as an
 * ordinary image element — the same path imported PDF pages already take.
 *
 * The LaTeX source travels with the element in `customData`, so a formula stays
 * editable rather than becoming a flat picture the moment it lands.
 */
import katex from 'katex';
import { toPng } from 'html-to-image';

/** Rendered well above display size, so a formula stays sharp when zoomed. */
const MATH_PIXEL_RATIO = 4;
/** Font size the formula is laid out at before scaling; sets the raster's detail. */
const MATH_FONT_PX = 32;

export interface MathRender {
  file: File;
  width: number;
  height: number;
}

/** Marker + source carried on the board element, so a formula can be re-edited. */
export interface MathCustomData {
  livetichMath: string;
}

export function mathSourceOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<MathCustomData>;
  return typeof data.livetichMath === 'string' ? data.livetichMath : null;
}

/**
 * Render LaTeX to HTML. Throws on invalid input so the editor can show the
 * error next to the box rather than putting a broken formula on the board.
 */
export function renderMathHtml(latex: string, display = true): string {
  return katex.renderToString(latex, {
    displayMode: display,
    throwOnError: true,
    output: 'html',
  });
}

/** True if the LaTeX parses — drives the live preview's error state. */
export function mathError(latex: string, display = true): string | null {
  try {
    renderMathHtml(latex, display);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid LaTeX';
  }
}

/**
 * Rasterise a formula to a transparent PNG.
 *
 * The node is laid out offscreen but must stay visible to the renderer —
 * `display:none` or `visibility:hidden` would measure as zero — so it is parked
 * far outside the viewport instead.
 */
export async function renderMathToPng(
  latex: string,
  color = '#1e1e1e',
  display = true,
): Promise<MathRender> {
  // Two nodes on purpose. The outer one is parked offscreen; the inner one —
  // the node actually captured — must stay statically positioned, because
  // html-to-image clones the node *with its own styles* into the SVG it builds.
  // Capturing a `position:fixed; left:-10000px` node draws the content 10000px
  // outside that SVG's viewport, and the result is a perfectly sized, entirely
  // blank image.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
  const inner = document.createElement('div');
  inner.style.cssText = [
    'display:inline-block',
    'padding:8px',
    'background:transparent',
    `color:${color}`,
    `font-size:${MATH_FONT_PX}px`,
    'line-height:1.2',
  ].join(';');
  inner.innerHTML = renderMathHtml(latex, display);
  host.appendChild(inner);
  document.body.appendChild(host);

  try {
    const rect = inner.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    // html-to-image inlines the KaTeX webfonts it finds in the document's
    // stylesheets; without that the glyphs would rasterise as blanks.
    const dataURL = await toPng(inner, {
      pixelRatio: MATH_PIXEL_RATIO,
      width,
      height,
      backgroundColor: undefined,
      skipAutoScale: true,
    });
    const blob = await (await fetch(dataURL)).blob();
    const file = new File([blob], `math-${Date.now()}.png`, { type: 'image/png' });
    return { file, width, height };
  } finally {
    host.remove();
  }
}
