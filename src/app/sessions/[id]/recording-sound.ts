/**
 * The little chime when recording starts and stops.
 *
 * Played through the instructor's own speakers, never published to the room —
 * nobody else is told the class is being recorded, so a tone that reached the
 * LiveKit audio track would undo that.
 *
 * Synthesised rather than shipped as files: two short notes need no binary
 * assets, no network round trip at the moment they matter, and no decode.
 */

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    return context;
  } catch {
    return null;
  }
}

/** One note, with a soft envelope — a bare gate would click at both ends. */
function tone(ctx: AudioContext, hz: number, startAt: number, seconds: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;

  const peak = 0.08; // quiet enough to sit under a voice, not over it
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + seconds + 0.02);
}

/**
 * Rising for started, falling for stopped — the direction carries the meaning
 * on its own, so it reads without looking at the button.
 */
export function playRecordingTone(kind: 'start' | 'stop'): void {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    // Browsers suspend a context created before any interaction. This is always
    // called from a click, so resuming here is allowed.
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const [first, second] = kind === 'start' ? [660, 990] : [880, 587];
    tone(ctx, first, now, 0.12);
    tone(ctx, second, now + 0.13, 0.16);
  } catch {
    // A missing or blocked audio device must never stop a recording.
  }
}
