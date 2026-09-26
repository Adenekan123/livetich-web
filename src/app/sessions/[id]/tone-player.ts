/**
 * The classroom's recorded tones — the ones that ship as files rather than
 * being synthesised note by note in `recording-sound.ts` and `playBuzzerCue`.
 *
 * Web Audio rather than `new Audio(src)` with `loop`, for three reasons that
 * all matter to the buzzer:
 *
 *  - An `<audio loop>` on an MP3 is not gapless. The format pads the end of the
 *    stream, and the element faithfully plays that padding before starting
 *    over, so a round would tick audibly on every wrap. Looping a decoded
 *    AudioBuffer repeats it sample-exactly instead.
 *  - A GainNode gives a real fade at both ends. The buzzer asset does not fade
 *    out on its own (its last 50ms still peak at ~0.05), so cutting it dead
 *    when someone answers would click.
 *  - It shares the AudioContext the rest of the room's audio already uses, and
 *    with it the one-gesture unlock that mobile browsers insist on.
 *
 * Every entry point is best-effort. A blocked, missing or broken audio device
 * must never take a lesson down with it.
 */

/** Shipped from `public/`, so they are versioned with the build and cached by
 *  the CDN like any other static asset. */
const SOURCES = {
  recordingStart: '/sounds/recording-start.mp3',
  buzzerQuestion: '/sounds/buzzer-question.mp3',
} as const;

export type ToneName = keyof typeof SOURCES;

/** Loud enough to carry over a room, quiet enough to talk across. The assets
 *  peak around 0.4, so this lands them near the synthesised cues' 0.18. */
const DEFAULT_GAIN = 0.45;
/** Long enough to not click, short enough to feel immediate. */
const FADE_IN_SEC = 0.06;
const FADE_OUT_SEC = 0.12;

let context: AudioContext | null = null;
const buffers = new Map<ToneName, Promise<AudioBuffer | null>>();
const loops = new Map<ToneName, { source: AudioBufferSourceNode; gain: GainNode }>();

/** The shared context, created lazily — never at module load, which would make
 *  it the browser's problem on every page that merely imports this. */
export function toneContext(): AudioContext | null {
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

/** Fetch and decode once; every later play reuses the buffer. Null on any
 *  failure, cached as null so a missing file is not re-fetched all lesson. */
function load(name: ToneName): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return cached;
  const pending = (async () => {
    const ctx = toneContext();
    if (!ctx) return null;
    try {
      const res = await fetch(SOURCES[name], { cache: 'force-cache' });
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  })();
  buffers.set(name, pending);
  return pending;
}

/**
 * Warm the cache and unlock the context, from a real user gesture.
 *
 * Both halves need that gesture. Mobile browsers start every AudioContext
 * suspended and only resume one from inside a tap, and the buzzer fires later
 * from a socket event — far too late to ask. Decoding here as well means the
 * first round of the lesson starts on time instead of after a 300KB download.
 */
export function primeTones(): void {
  const ctx = toneContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* nothing to do — playback will simply stay silent */
  }
  for (const name of Object.keys(SOURCES) as ToneName[]) void load(name);
}

/** Play once. Resolves false when there was nothing to play, so a caller can
 *  fall back to a synthesised cue rather than giving the user silence. */
export async function playTone(
  name: ToneName,
  gainValue = DEFAULT_GAIN,
): Promise<boolean> {
  const ctx = toneContext();
  const buffer = await load(name);
  if (!ctx || !buffer) return false;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    source.connect(gain).connect(ctx.destination);
    source.start();
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* already torn down */
      }
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a tone looping until `stopTone` is called.
 *
 * Idempotent: asking for a loop that is already running does nothing, so a
 * repeated socket event cannot stack two copies over each other.
 */
export async function startToneLoop(
  name: ToneName,
  gainValue = DEFAULT_GAIN,
): Promise<void> {
  if (loops.has(name)) return;
  const ctx = toneContext();
  const buffer = await load(name);
  if (!ctx || !buffer) return;
  // Another call may have won the race while this one was decoding.
  if (loops.has(name)) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + FADE_IN_SEC);
    source.connect(gain).connect(ctx.destination);
    source.start();
    loops.set(name, { source, gain });
  } catch {
    /* leave the round silent rather than broken */
  }
}

/** Fade out and stop. Safe to call when nothing is playing. */
export function stopToneLoop(name: ToneName): void {
  const active = loops.get(name);
  if (!active) return;
  loops.delete(name);
  const ctx = toneContext();
  try {
    if (!ctx) {
      active.source.stop();
      return;
    }
    const now = ctx.currentTime;
    // Ramp from wherever the gain actually is, so stopping mid-fade-in does not
    // jump to full volume first.
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(Math.max(0.0001, active.gain.gain.value), now);
    active.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT_SEC);
    active.source.stop(now + FADE_OUT_SEC + 0.02);
    active.source.onended = () => {
      try {
        active.source.disconnect();
        active.gain.disconnect();
      } catch {
        /* already torn down */
      }
    };
  } catch {
    /* best effort */
  }
}

/** Stop everything — for leaving the room, where a tone outliving the class
 *  would be worse than one that never played. */
export function stopAllToneLoops(): void {
  for (const name of [...loops.keys()]) stopToneLoop(name);
}
