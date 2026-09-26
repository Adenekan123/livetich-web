/**
 * The pattern the two entry screens share.
 *
 * Hairline concentric circles, tight at the source and opening out, fading to
 * white under whatever column is being read. On the prejoin screen they double
 * as the level meter: the page writes `--voice` (0–1) sixty times a second and
 * every ring lifts and widens with it, the far ones proportionally more, so a
 * pulse travels outward as you speak. Anywhere `--voice` is never written it
 * simply renders as a still field, which is what the class link wants.
 *
 * Reduced motion pins `--voice` to 0: the pattern stays, the reaction goes.
 */

export function BroadcastRings({
  /** Fade the right half to white, for a layout with a reading column there. */
  scrim = true,
  /**
   * Where the rings come from.
   *
   * `preview` sets the origin under the camera preview, which covers it — the
   * rings then read as coming off the person. With nothing over the origin the
   * same placement reads as a bullseye parked beside the text, so `edge` puts
   * it off the left of the viewport and only the outward arcs cross the page.
   */
  origin = 'preview',
}: {
  scrim?: boolean;
  origin?: 'preview' | 'edge';
}) {
  // Not an even lattice — the spacing opens as it travels, the way a signal
  // actually leaves a room. Every fourth ring is heavier so the field has a
  // beat rather than reading as noise.
  const rings = [78, 128, 186, 252, 326, 408, 498, 596, 702, 816, 938];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:[--voice:0]"
    >
      <svg
        className={
          origin === 'edge'
            ? 'absolute left-1/2 top-1/2 h-475 w-475 translate-x-[-96%] translate-y-[-50%] text-signal-300 lg:translate-x-[-88%]'
            : 'absolute left-1/2 top-1/2 h-475 w-475 translate-x-[-78%] translate-y-[-50%] text-signal-300 lg:translate-x-[-62%]'
        }
        viewBox="0 0 1900 1900"
        fill="none"
      >
        {rings.map((r, i) => (
          <circle
            key={r}
            cx={950}
            cy={950}
            r={r}
            stroke="currentColor"
            strokeWidth={i % 4 === 0 ? 2 : 1}
            style={{
              opacity: `calc(${Math.max(0.12, 0.72 - i * 0.055).toFixed(3)} + var(--voice, 0) * ${(0.28 + i * 0.03).toFixed(3)})`,
              transformOrigin: '950px 950px',
              transform: `scale(calc(1 + var(--voice, 0) * ${(0.008 + i * 0.0025).toFixed(4)}))`,
              transition: 'opacity 110ms linear, transform 140ms ease-out',
            }}
          />
        ))}
      </svg>
      {scrim && (
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-linear-to-r from-transparent to-white lg:block" />
      )}
    </div>
  );
}
