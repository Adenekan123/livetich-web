/**
 * Guard for the whiteboard's math palette.
 *
 * Every entry is a hand-written LaTeX command with a hand-counted offset into
 * itself. Both are easy to get subtly wrong, and the failure only shows up as an
 * instructor clicking a button mid-lesson and getting an error instead of a
 * formula. So: render each entry through the real KaTeX, and check each
 * placeholder offset actually lands on the blank it claims to.
 *
 * Run with:  pnpm check:math
 */
import katex from 'katex';
import { MATH_ENTRIES, MATH_CATEGORIES } from '../src/app/sessions/[id]/board-math-palette.ts';

let failed = 0;
const seen = new Map();

for (const entry of MATH_ENTRIES) {
  const where = `${entry.category}/${entry.label}`;

  // 1. The inserted LaTeX must render.
  try {
    katex.renderToString(entry.latex, { throwOnError: true, displayMode: false });
  } catch (e) {
    failed++;
    console.log(`RENDER  ${where}: ${JSON.stringify(entry.latex)} -> ${e.message.split('\n')[0]}`);
  }

  // 2. So must the button's own preview, when it has one.
  if (entry.preview) {
    try {
      katex.renderToString(entry.preview, { throwOnError: true, displayMode: false });
    } catch (e) {
      failed++;
      console.log(`PREVIEW ${where}: ${e.message.split('\n')[0]}`);
    }
  }

  // 3. A select offset must land on a real placeholder, not a brace or command.
  if (entry.select) {
    const [off, len] = entry.select;
    const picked = entry.latex.slice(off, off + len);
    if (picked.length !== len || !/^[A-Za-z0-9=]+$/.test(picked)) {
      failed++;
      console.log(`SELECT  ${where}: offset ${off},${len} picks ${JSON.stringify(picked)} from ${JSON.stringify(entry.latex)}`);
    }
  }

  // 4. Two buttons inserting the same thing is a copy-paste slip.
  if (seen.has(entry.latex)) {
    failed++;
    console.log(`DUPE    ${where}: same latex as ${seen.get(entry.latex)}`);
  }
  seen.set(entry.latex, where);

  // 5. A category not in the tab list would be unreachable in the UI.
  if (!MATH_CATEGORIES.includes(entry.category)) {
    failed++;
    console.log(`CATEGORY ${where}: "${entry.category}" is not a listed category`);
  }
}

const counts = MATH_CATEGORIES.map(
  (c) => `${c}: ${MATH_ENTRIES.filter((e) => e.category === c).length}`,
).join(', ');
console.log(`${MATH_ENTRIES.length} entries (${counts})`);
console.log(failed === 0 ? 'all entries render and every offset lands on a blank' : `${failed} problem(s)`);
process.exit(failed === 0 ? 0 : 1);
