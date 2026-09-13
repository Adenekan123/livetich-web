/**
 * Google Docs, Sheets, Slides, Forms and Drive files on the board.
 *
 * An instructor pastes the link they already have — the one from the address
 * bar, ending in /edit — and that exact URL cannot be framed: Google refuses to
 * render its editors inside someone else's page. What it does allow is the
 * read-only viewer, which lives at a different path per product (/preview for
 * documents, spreadsheets and Drive files, /embed for slides, ?embedded=true
 * for forms). So the pasted link is translated rather than used as-is.
 *
 * The board still stores the original link, so "open in Google" always leads
 * back to the real thing, and the embed is only what gets rendered.
 *
 * Two limits are Google's, not ours, and both are worth stating out loud
 * wherever this is used:
 *
 *  - The viewer is read-only. Nobody can type into a doc on the board.
 *  - The file has to be shared — "anyone with the link" — or the frame shows a
 *    sign-in wall. A viewer's own Google session usually cannot rescue it,
 *    because browsers now block third-party cookies inside iframes.
 */

export type GoogleDocKind = 'document' | 'spreadsheet' | 'presentation' | 'form' | 'file';

export interface GoogleEmbed {
  /** What to put in the iframe. */
  src: string;
  kind: GoogleDocKind;
  /** For the overlay bar: "Google Doc", "Google Sheet", … */
  label: string;
}

const LABELS: Record<GoogleDocKind, string> = {
  document: 'Google Doc',
  spreadsheet: 'Google Sheet',
  presentation: 'Google Slides',
  form: 'Google Form',
  file: 'Google Drive file',
};

/** Google's own id alphabet, plus the `e/…` forms use for its long ids. */
const ID = '[A-Za-z0-9_-]+';

const PATTERNS: { re: RegExp; kind: GoogleDocKind; build: (id: string) => string }[] = [
  {
    re: new RegExp(`^https://docs\\.google\\.com/document/d/(${ID})`),
    kind: 'document',
    build: (id) => `https://docs.google.com/document/d/${id}/preview`,
  },
  {
    re: new RegExp(`^https://docs\\.google\\.com/spreadsheets/d/(${ID})`),
    kind: 'spreadsheet',
    build: (id) => `https://docs.google.com/spreadsheets/d/${id}/preview`,
  },
  {
    // Slides is the odd one out: its viewer is /embed, not /preview.
    re: new RegExp(`^https://docs\\.google\\.com/presentation/d/(${ID})`),
    kind: 'presentation',
    build: (id) => `https://docs.google.com/presentation/d/${id}/embed`,
  },
  {
    // Forms ids live under /d/e/ and are not the same as the edit id, so only
    // a link that already carries the published form works here.
    re: new RegExp(`^https://docs\\.google\\.com/forms/d/e/(${ID})`),
    kind: 'form',
    build: (id) => `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true`,
  },
  {
    // Anything stored in Drive rather than authored in it — a PDF, an image, a
    // scanned worksheet.
    re: new RegExp(`^https://drive\\.google\\.com/file/d/(${ID})`),
    kind: 'file',
    build: (id) => `https://drive.google.com/file/d/${id}/preview`,
  },
];

/**
 * The embeddable form of a Google link, or null if it is not one.
 *
 * Null is the signal to leave the link alone: it means "not ours", not
 * "broken", so YouTube and every other embed keep their own handling.
 */
export function googleEmbed(link: string | null | undefined): GoogleEmbed | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  // https only, and only Google's own hosts — a lookalike domain must not be
  // able to get itself framed inside a lesson.
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'docs.google.com' && url.hostname !== 'drive.google.com') {
    return null;
  }
  const base = `https://${url.hostname}${url.pathname}`;
  for (const { re, kind, build } of PATTERNS) {
    const m = re.exec(base);
    if (m) return { src: build(m[1]), kind, label: LABELS[kind] };
  }
  return null;
}
