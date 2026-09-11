/**
 * The little flourish when recording starts and stops.
 *
 * Played through the instructor's own speakers, never published to the room —
 * nobody else is told the class is being recorded, so a tone that reached the
 * LiveKit audio track would undo that.
 *
 * Synthesised rather than shipped as files: a few short notes need no binary
 * assets, no network round trip at the moment they matter, and no decode.
 *
 * Deliberately unlike the classroom's own notification beeps in
 * `class-room.tsx` — those are two flat square or triangle notes, and the old
 * version of this chime was note-for-note the "win" sound. Three notes, a
 * pitch bend and a shimmer on top make this read as its own event even when
 * the instructor is not looking at the button.
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

interface Note {
  /** Seconds from the start of the flourish. */
  at: number;
  seconds: number;
  hz: number;
  /** Bend to this pitch across the note; omit to hold steady. */
  to?: number;
  type?: OscillatorType;
  peak?: number;
}

/** One note, with a soft envelope — a bare gate would click at both ends. */
function play(ctx: AudioContext, t0: number, n: Note) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = n.type ?? 'triangle';

  const start = t0 + n.at;
  const end = start + n.seconds;
  osc.frequency.setValueAtTime(n.hz, start);
  if (n.to != null && n.to !== n.hz) {
    // The bend is what makes it playful rather than clinical.
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, n.to), end);
  }

  // Quiet enough to sit under a voice, not over it.
  const peak = n.peak ?? 0.09;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.03);
}

/**
 * Rising and bright for started, falling and warm for stopped — the direction
 * carries the meaning on its own, so it reads without looking at the button.
 */
const FLOURISH: Record<'start' | 'stop', Note[]> = {
  // C5, F5, then A5 blipping up to C6, with an octave of sparkle over it.
  // The pitches deliberately avoid 660 and 990 — those two are the classroom's
  // "win" beep, and landing on them is what made the old chime ambiguous.
  start: [
    { at: 0, seconds: 0.09, hz: 523.25 },
    { at: 0.085, seconds: 0.09, hz: 698.46 },
    { at: 0.17, seconds: 0.28, hz: 880.0, to: 1046.5 },
    { at: 0.17, seconds: 0.22, hz: 1760.0, type: 'sine', peak: 0.028 },
  ],
  // The same shape inverted and softened: A5, F5, then settling onto C5.
  stop: [
    { at: 0, seconds: 0.09, hz: 880.0 },
    { at: 0.085, seconds: 0.09, hz: 698.46 },
    { at: 0.17, seconds: 0.34, hz: 523.25, to: 493.88, type: 'sine' },
  ],
};

export function playRecordingTone(kind: 'start' | 'stop'): void {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    // Browsers suspend a context created before any interaction. This is always
    // called from a click, so resuming here is allowed.
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    for (const note of FLOURISH[kind]) play(ctx, now, note);
  } catch {
    // A missing or blocked audio device must never stop a recording.
  }
}
