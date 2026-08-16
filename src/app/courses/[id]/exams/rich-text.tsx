/** ALOC question text embeds <sup>/<sub> (and the odd <br>) HTML. Render just
 *  that whitelist safely: escape everything, then re-enable those tags — so
 *  "(343)<sup>1/3</sup>" shows as proper math, never as literal markup, and no
 *  other markup (scripts, attributes) can slip through. */
export function richHtml(s: string): string {
  const esc = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/&lt;(\/?)(sup|sub)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>');
}

export function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: richHtml(text) }} />
  );
}
