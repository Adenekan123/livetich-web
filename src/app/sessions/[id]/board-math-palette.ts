/**
 * The pick-don't-type half of the math tool.
 *
 * Typing LaTeX is a skill most instructors do not have and should not need for
 * a lesson. Structures insert the *shape* of a formula with their first blank
 * pre-selected, so the next keystroke replaces it; symbols cover the characters
 * nobody can guess the command for. Between them a formula can be built without
 * knowing any LaTeX at all.
 *
 * KaTeX defines around a thousand commands. Browsing that is worse than useless,
 * so entries are grouped and searchable — search is what actually finds a glyph,
 * the categories are for when you don't yet know what you want.
 *
 * Every entry here is checked against KaTeX at build time by the palette test:
 * a typo in a command would otherwise reach a classroom as a formula that
 * refuses to render.
 */

export type MathCategory =
  | 'Structures'
  | 'Greek'
  | 'Operators'
  | 'Relations'
  | 'Arrows'
  | 'Sets & logic'
  | 'Calculus'
  | 'Delimiters'
  | 'Accents';

export const MATH_CATEGORIES: MathCategory[] = [
  'Structures',
  'Greek',
  'Operators',
  'Relations',
  'Arrows',
  'Sets & logic',
  'Calculus',
  'Delimiters',
  'Accents',
];

export interface MathEntry {
  /** Inserted at the cursor. */
  latex: string;
  label: string;
  category: MathCategory;
  /** Extra search terms — what someone would type looking for this. */
  keywords?: string;
  /** Shown on the button. Entries without one are rendered as maths instead. */
  char?: string;
  /** LaTeX rendered on the button when there is no `char`. */
  preview?: string;
  /** [offset, length] of the blank to select after inserting. */
  select?: [number, number];
}

/**
 * Commands that end in a letter need a trailing space, or the next character
 * typed runs into the command name: `\pi` + `x` would become `\pix`.
 */
const s = (
  char: string,
  latex: string,
  label: string,
  category: MathCategory,
  keywords?: string,
): MathEntry => ({ char, latex, label, category, keywords });

export const MATH_ENTRIES: MathEntry[] = [
  // ---- Structures ----------------------------------------------------------
  { latex: '\\frac{a}{b}', preview: '\\frac{a}{b}', label: 'Fraction', category: 'Structures', keywords: 'divide over quotient', select: [6, 1] },
  { latex: '\\tfrac{a}{b}', preview: '\\tfrac{a}{b}', label: 'Small fraction', category: 'Structures', keywords: 'inline divide', select: [7, 1] },
  { latex: 'x^{2}', preview: 'x^{2}', label: 'Power', category: 'Structures', keywords: 'exponent superscript squared', select: [3, 1] },
  { latex: 'x_{1}', preview: 'x_{1}', label: 'Subscript', category: 'Structures', keywords: 'index below', select: [3, 1] },
  { latex: 'x_{1}^{2}', preview: 'x_{1}^{2}', label: 'Sub and superscript', category: 'Structures', keywords: 'index exponent', select: [3, 1] },
  { latex: '\\sqrt{x}', preview: '\\sqrt{x}', label: 'Square root', category: 'Structures', keywords: 'radical surd', select: [6, 1] },
  { latex: '\\sqrt[n]{x}', preview: '\\sqrt[n]{x}', label: 'Nth root', category: 'Structures', keywords: 'radical cube', select: [6, 1] },
  { latex: '\\binom{n}{k}', preview: '\\binom{n}{k}', label: 'Binomial', category: 'Structures', keywords: 'choose combination', select: [7, 1] },
  { latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', preview: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', label: 'Matrix', category: 'Structures', keywords: 'array grid', select: [16, 1] },
  { latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', preview: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', label: 'Square matrix', category: 'Structures', keywords: 'array bracket', select: [16, 1] },
  { latex: '\\begin{cases} a & x > 0 \\\\ b & x < 0 \\end{cases}', preview: '\\begin{cases} a & x > 0 \\\\ b & x < 0 \\end{cases}', label: 'Cases', category: 'Structures', keywords: 'piecewise branch if', select: [14, 1] },
  { latex: '\\overset{a}{b}', preview: '\\overset{a}{b}', label: 'Text above', category: 'Structures', keywords: 'over stacked', select: [9, 1] },
  { latex: '\\underset{a}{b}', preview: '\\underset{a}{b}', label: 'Text below', category: 'Structures', keywords: 'under stacked', select: [10, 1] },
  { latex: '\\text{word}', preview: '\\text{word}', label: 'Plain text', category: 'Structures', keywords: 'words label roman', select: [6, 4] },

  // ---- Greek ---------------------------------------------------------------
  s('α', '\\alpha ', 'alpha', 'Greek'),
  s('β', '\\beta ', 'beta', 'Greek'),
  s('γ', '\\gamma ', 'gamma', 'Greek'),
  s('δ', '\\delta ', 'delta', 'Greek'),
  s('ε', '\\epsilon ', 'epsilon', 'Greek'),
  s('ε', '\\varepsilon ', 'varepsilon', 'Greek', 'epsilon'),
  s('ζ', '\\zeta ', 'zeta', 'Greek'),
  s('η', '\\eta ', 'eta', 'Greek'),
  s('θ', '\\theta ', 'theta', 'Greek', 'angle'),
  s('ϑ', '\\vartheta ', 'vartheta', 'Greek', 'theta'),
  s('ι', '\\iota ', 'iota', 'Greek'),
  s('κ', '\\kappa ', 'kappa', 'Greek'),
  s('λ', '\\lambda ', 'lambda', 'Greek', 'wavelength'),
  s('μ', '\\mu ', 'mu', 'Greek', 'micro mean'),
  s('ν', '\\nu ', 'nu', 'Greek'),
  s('ξ', '\\xi ', 'xi', 'Greek'),
  s('π', '\\pi ', 'pi', 'Greek', 'circle 3.14'),
  s('ρ', '\\rho ', 'rho', 'Greek', 'density'),
  s('σ', '\\sigma ', 'sigma', 'Greek', 'deviation'),
  s('τ', '\\tau ', 'tau', 'Greek'),
  s('υ', '\\upsilon ', 'upsilon', 'Greek'),
  s('φ', '\\phi ', 'phi', 'Greek'),
  s('φ', '\\varphi ', 'varphi', 'Greek', 'phi'),
  s('χ', '\\chi ', 'chi', 'Greek', 'chi squared'),
  s('ψ', '\\psi ', 'psi', 'Greek'),
  s('ω', '\\omega ', 'omega', 'Greek'),
  s('Γ', '\\Gamma ', 'Gamma', 'Greek'),
  s('Δ', '\\Delta ', 'Delta', 'Greek', 'change difference'),
  s('Θ', '\\Theta ', 'Theta', 'Greek'),
  s('Λ', '\\Lambda ', 'Lambda', 'Greek'),
  s('Ξ', '\\Xi ', 'Xi', 'Greek'),
  s('Π', '\\Pi ', 'Pi', 'Greek', 'product'),
  s('Σ', '\\Sigma ', 'Sigma', 'Greek', 'sum'),
  s('Φ', '\\Phi ', 'Phi', 'Greek'),
  s('Ψ', '\\Psi ', 'Psi', 'Greek'),
  s('Ω', '\\Omega ', 'Omega', 'Greek', 'ohm'),

  // ---- Operators -----------------------------------------------------------
  s('±', '\\pm ', 'plus or minus', 'Operators'),
  s('∓', '\\mp ', 'minus or plus', 'Operators'),
  s('×', '\\times ', 'times', 'Operators', 'multiply product cross'),
  s('÷', '\\div ', 'divided by', 'Operators', 'divide'),
  s('⋅', '\\cdot ', 'dot', 'Operators', 'multiply product'),
  s('∗', '\\ast ', 'asterisk', 'Operators', 'star convolution'),
  s('∘', '\\circ ', 'composition', 'Operators', 'ring compose'),
  s('⊕', '\\oplus ', 'circled plus', 'Operators', 'xor direct sum'),
  s('⊖', '\\ominus ', 'circled minus', 'Operators'),
  s('⊗', '\\otimes ', 'circled times', 'Operators', 'tensor kronecker'),
  s('⊙', '\\odot ', 'circled dot', 'Operators', 'hadamard'),
  s('∑', '\\sum ', 'sum', 'Operators', 'sigma total add'),
  s('∏', '\\prod ', 'product', 'Operators', 'pi multiply'),
  s('∐', '\\coprod ', 'coproduct', 'Operators'),
  s('√', '\\surd ', 'radical sign', 'Operators', 'root'),
  s('¬', '\\neg ', 'not', 'Operators', 'negation'),
  s('⌈', '\\lceil ', 'left ceiling', 'Operators', 'round up'),
  s('⌉', '\\rceil ', 'right ceiling', 'Operators', 'round up'),
  s('⌊', '\\lfloor ', 'left floor', 'Operators', 'round down'),
  s('⌋', '\\rfloor ', 'right floor', 'Operators', 'round down'),

  // ---- Relations -----------------------------------------------------------
  s('≠', '\\neq ', 'not equal', 'Relations'),
  s('≈', '\\approx ', 'approximately', 'Relations', 'about roughly'),
  s('≡', '\\equiv ', 'equivalent', 'Relations', 'identical congruent modulo'),
  s('∼', '\\sim ', 'similar', 'Relations', 'distributed as tilde'),
  s('≃', '\\simeq ', 'asymptotically equal', 'Relations'),
  s('≅', '\\cong ', 'congruent', 'Relations'),
  s('≤', '\\leq ', 'less than or equal', 'Relations', 'lte at most'),
  s('≥', '\\geq ', 'greater than or equal', 'Relations', 'gte at least'),
  s('≪', '\\ll ', 'much less than', 'Relations'),
  s('≫', '\\gg ', 'much greater than', 'Relations'),
  s('∝', '\\propto ', 'proportional to', 'Relations', 'varies'),
  s('⊥', '\\perp ', 'perpendicular', 'Relations', 'orthogonal normal'),
  s('∥', '\\parallel ', 'parallel', 'Relations'),
  s('≺', '\\prec ', 'precedes', 'Relations'),
  s('≻', '\\succ ', 'succeeds', 'Relations'),
  s('≐', '\\doteq ', 'approaches the limit', 'Relations'),
  s('≜', '\\triangleq ', 'defined as', 'Relations', 'definition'),

  // ---- Arrows --------------------------------------------------------------
  s('→', '\\to ', 'to', 'Arrows', 'right arrow maps approaches'),
  s('←', '\\gets ', 'from', 'Arrows', 'left arrow'),
  s('↔', '\\leftrightarrow ', 'left right arrow', 'Arrows'),
  s('⇒', '\\Rightarrow ', 'implies', 'Arrows', 'therefore double'),
  s('⇐', '\\Leftarrow ', 'implied by', 'Arrows'),
  s('⇔', '\\Leftrightarrow ', 'if and only if', 'Arrows', 'iff equivalent'),
  s('↦', '\\mapsto ', 'maps to', 'Arrows', 'function'),
  s('↑', '\\uparrow ', 'up arrow', 'Arrows', 'increases'),
  s('↓', '\\downarrow ', 'down arrow', 'Arrows', 'decreases'),
  s('↗', '\\nearrow ', 'north east arrow', 'Arrows', 'increasing'),
  s('↘', '\\searrow ', 'south east arrow', 'Arrows', 'decreasing'),
  s('⟶', '\\longrightarrow ', 'long right arrow', 'Arrows', 'reaction'),
  s('⟵', '\\longleftarrow ', 'long left arrow', 'Arrows'),
  s('⇌', '\\rightleftharpoons ', 'equilibrium', 'Arrows', 'reversible reaction'),
  s('↪', '\\hookrightarrow ', 'hooked arrow', 'Arrows', 'injection embeds'),

  // ---- Sets & logic --------------------------------------------------------
  s('∈', '\\in ', 'element of', 'Sets & logic', 'belongs member'),
  s('∉', '\\notin ', 'not an element of', 'Sets & logic'),
  s('∋', '\\ni ', 'contains as member', 'Sets & logic'),
  s('⊂', '\\subset ', 'subset', 'Sets & logic'),
  s('⊃', '\\supset ', 'superset', 'Sets & logic'),
  s('⊆', '\\subseteq ', 'subset or equal', 'Sets & logic'),
  s('⊇', '\\supseteq ', 'superset or equal', 'Sets & logic'),
  s('∪', '\\cup ', 'union', 'Sets & logic', 'or join'),
  s('∩', '\\cap ', 'intersection', 'Sets & logic', 'and meet'),
  s('∖', '\\setminus ', 'set difference', 'Sets & logic', 'minus without'),
  s('∅', '\\emptyset ', 'empty set', 'Sets & logic', 'null void'),
  s('∀', '\\forall ', 'for all', 'Sets & logic', 'every universal'),
  s('∃', '\\exists ', 'there exists', 'Sets & logic', 'some existential'),
  s('∄', '\\nexists ', 'there does not exist', 'Sets & logic'),
  s('∧', '\\land ', 'and', 'Sets & logic', 'conjunction wedge'),
  s('∨', '\\lor ', 'or', 'Sets & logic', 'disjunction vee'),
  s('∴', '\\therefore ', 'therefore', 'Sets & logic', 'thus conclusion'),
  s('∵', '\\because ', 'because', 'Sets & logic', 'since'),
  s('ℝ', '\\mathbb{R}', 'real numbers', 'Sets & logic', 'reals blackboard'),
  s('ℕ', '\\mathbb{N}', 'natural numbers', 'Sets & logic', 'naturals counting'),
  s('ℤ', '\\mathbb{Z}', 'integers', 'Sets & logic', 'whole numbers'),
  s('ℚ', '\\mathbb{Q}', 'rational numbers', 'Sets & logic', 'fractions'),
  s('ℂ', '\\mathbb{C}', 'complex numbers', 'Sets & logic', 'imaginary'),

  // ---- Calculus ------------------------------------------------------------
  { latex: '\\int_{a}^{b}', preview: '\\int_{a}^{b}', label: 'Integral', category: 'Calculus', keywords: 'area antiderivative', select: [6, 1] },
  { latex: '\\iint_{D}', preview: '\\iint_{D}', label: 'Double integral', category: 'Calculus', keywords: 'surface area', select: [7, 1] },
  { latex: '\\oint_{C}', preview: '\\oint_{C}', label: 'Contour integral', category: 'Calculus', keywords: 'closed loop line', select: [7, 1] },
  { latex: '\\sum_{i=1}^{n}', preview: '\\sum_{i=1}^{n}', label: 'Summation', category: 'Calculus', keywords: 'sigma total series', select: [6, 3] },
  { latex: '\\prod_{i=1}^{n}', preview: '\\prod_{i=1}^{n}', label: 'Product', category: 'Calculus', keywords: 'pi multiply series', select: [7, 3] },
  { latex: '\\lim_{x \\to 0}', preview: '\\lim_{x \\to 0}', label: 'Limit', category: 'Calculus', keywords: 'approaches tends', select: [6, 1] },
  { latex: '\\frac{d}{dx}', preview: '\\frac{d}{dx}', label: 'Derivative', category: 'Calculus', keywords: 'differentiate rate', select: [10, 1] },
  { latex: '\\frac{\\partial f}{\\partial x}', preview: '\\frac{\\partial f}{\\partial x}', label: 'Partial derivative', category: 'Calculus', keywords: 'gradient del', select: [15, 1] },
  s('∂', '\\partial ', 'partial', 'Calculus', 'derivative del'),
  s('∇', '\\nabla ', 'nabla', 'Calculus', 'gradient div curl del'),
  s('∞', '\\infty ', 'infinity', 'Calculus', 'unbounded endless'),
  s('′', "'", 'prime', 'Calculus', 'derivative dash'),
  s('…', '\\dots ', 'ellipsis', 'Calculus', 'dots and so on'),
  s('⋯', '\\cdots ', 'centred ellipsis', 'Calculus', 'dots'),

  // ---- Delimiters ----------------------------------------------------------
  { latex: '\\left( x \\right)', preview: '\\left( x \\right)', label: 'Parentheses', category: 'Delimiters', keywords: 'brackets round', select: [7, 1] },
  { latex: '\\left[ x \\right]', preview: '\\left[ x \\right]', label: 'Square brackets', category: 'Delimiters', keywords: 'brackets', select: [7, 1] },
  { latex: '\\left\\{ x \\right\\}', preview: '\\left\\{ x \\right\\}', label: 'Braces', category: 'Delimiters', keywords: 'curly set', select: [8, 1] },
  { latex: '\\left| x \\right|', preview: '\\left| x \\right|', label: 'Absolute value', category: 'Delimiters', keywords: 'modulus magnitude', select: [7, 1] },
  { latex: '\\left\\| x \\right\\|', preview: '\\left\\| x \\right\\|', label: 'Norm', category: 'Delimiters', keywords: 'length magnitude', select: [8, 1] },
  { latex: '\\langle x \\rangle', preview: '\\langle x \\rangle', label: 'Angle brackets', category: 'Delimiters', keywords: 'inner product bra ket', select: [8, 1] },

  // ---- Accents -------------------------------------------------------------
  { latex: '\\hat{x}', preview: '\\hat{x}', label: 'Hat', category: 'Accents', keywords: 'estimate unit circumflex', select: [5, 1] },
  { latex: '\\bar{x}', preview: '\\bar{x}', label: 'Bar', category: 'Accents', keywords: 'mean average overline', select: [5, 1] },
  { latex: '\\vec{v}', preview: '\\vec{v}', label: 'Vector', category: 'Accents', keywords: 'arrow direction', select: [5, 1] },
  { latex: '\\dot{x}', preview: '\\dot{x}', label: 'Dot', category: 'Accents', keywords: 'time derivative velocity', select: [5, 1] },
  { latex: '\\ddot{x}', preview: '\\ddot{x}', label: 'Double dot', category: 'Accents', keywords: 'acceleration second derivative', select: [6, 1] },
  { latex: '\\tilde{x}', preview: '\\tilde{x}', label: 'Tilde', category: 'Accents', keywords: 'approximate', select: [7, 1] },
  { latex: '\\overline{AB}', preview: '\\overline{AB}', label: 'Overline', category: 'Accents', keywords: 'segment bar conjugate', select: [10, 2] },
  { latex: '\\underline{x}', preview: '\\underline{x}', label: 'Underline', category: 'Accents', keywords: 'underscore', select: [11, 1] },
  { latex: '\\overrightarrow{AB}', preview: '\\overrightarrow{AB}', label: 'Ray', category: 'Accents', keywords: 'vector segment arrow', select: [16, 2] },
];

/** Free-text match across label, keywords, category and the command itself. */
export function searchMath(entries: MathEntry[], query: string): MathEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    `${e.label} ${e.keywords ?? ''} ${e.category} ${e.latex} ${e.char ?? ''}`
      .toLowerCase()
      .includes(q),
  );
}
