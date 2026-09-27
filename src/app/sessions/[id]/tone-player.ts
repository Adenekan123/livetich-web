/**
 * The classroom's recorded tones — the ones that ship as files rather than
 * being synthesised note by note in `recording-sound.ts` and `playBuzzerCue` —
 * plus the synthesised room cues (the buzzer question tone, a student joining,
 * the class ending), which share this module's AudioContext and its
 * one-gesture unlock.
 *
 * Web Audio rather than `new Audio(src)` with `loop`, for three reasons that
 * all matter to a looping tone:
 *
 *  - An `<audio loop>` on an MP3 is not gapless. The format pads the end of the
 *    stream, and the element faithfully plays that padding before starting
 *    over, so a loop would tick audibly on every wrap. Looping a decoded
 *    AudioBuffer repeats it sample-exactly instead.
 *  - A GainNode gives a real fade at both ends, so a tone cut short — a
 *    question someone has just answered — fades rather than clicks.
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

/** The last stretch of a question, where the ticks double and rise. */
const QUESTION_URGENT_SEC = 5;
/** A question tone is scheduled in full up front; this bounds how many notes
 *  one round can queue, whatever time limit it arrives with. */
const QUESTION_MAX_SEC = 600;

let question: GainNode | null = null;

/** One enveloped oscillator note on the audio clock, routed through `out`. */
function note(
  out: GainNode,
  at: number,
  dur: number,
  freq: number,
  type: OscillatorType,
  peak: number,
): void {
  const ctx = out.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.012, dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** A woodblock-like tick: a short sine with a fast decay and a faint overtone. */
function tick(out: GainNode, at: number, freq: number, peak: number): void {
  note(out, at, 0.06, freq, 'sine', peak);
  note(out, at, 0.03, freq * 2.01, 'sine', peak * 0.35);
}

/**
 * The buzzer question tone, for a round of `seconds`: a rising three-note
 * chime (C5 E5 G5) as the question appears, then a soft tick every second, and
 * for the last five seconds a higher tick twice a second — so the room hears
 * both "new question" and the time draining away.
 *
 * Synthesised rather than shipped, so there is nothing to download before the
 * first round. The whole round is scheduled up front on the audio clock, which
 * keeps the ticks even however busy the page is, under one gain node so that
 * stopping is a single fade. Starting again replaces a round still playing.
 */
export function startQuestionTone(seconds: number): void {
  stopQuestionTone();
  const ctx = toneContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const total = Math.min(
      QUESTION_MAX_SEC,
      Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
    );
    const out = ctx.createGain();
    out.connect(ctx.destination);
    question = out;
    const t0 = ctx.currentTime + 0.03;

    [523.25, 659.25, 783.99].forEach((freq, i) => {
      note(out, t0 + i * 0.1, 0.32, freq, 'triangle', 0.2);
      note(out, t0 + i * 0.1, 0.2, freq * 2, 'sine', 0.05);
    });

    // The fast ticks never start under the chime, even on a very short round.
    const urgentFrom = Math.max(0.6, total - QUESTION_URGENT_SEC);
    for (let s = 1; s < urgentFrom; s += 1) tick(out, t0 + s, 1150, 0.12);
    for (let s = urgentFrom; s < total; s += 0.5) tick(out, t0 + s, 1500, 0.16);
  } catch {
    /* leave the round silent rather than broken */
  }
}

/** Fade out whatever is left of the question tone. Safe when nothing plays. */
export function stopQuestionTone(): void {
  const out = question;
  if (!out) return;
  question = null;
  try {
    const now = out.context.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
    out.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT_SEC);
    // Notes still queued for later play into a disconnected node: silent, and
    // collected once their own stop time passes.
    setTimeout(() => {
      try {
        out.disconnect();
      } catch {
        /* already torn down */
      }
    }, (FADE_OUT_SEC + 0.05) * 1000);
  } catch {
    /* best effort */
  }
}

/** A one-shot synthesised cue: `schedule` lays its notes on a fresh gain node
 *  from `t0`; the node is released once `lengthSec` has played out. */
function playCue(
  lengthSec: number,
  schedule: (out: GainNode, t0: number) => void,
): void {
  const ctx = toneContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    schedule(out, ctx.currentTime + 0.03);
    setTimeout(() => {
      try {
        out.disconnect();
      } catch {
        /* already torn down */
      }
    }, (lengthSec + 0.3) * 1000);
  } catch {
    /* a missed cue is fine; a broken room is not */
  }
}

/** A student has joined: a soft falling "dong-ding" (E5 then B4). Quiet on
 *  purpose — the instructor hears it mid-sentence, many times a lesson. */
export function playJoinTone(): void {
  playCue(1.5, (out, t) => {
    note(out, t, 0.7, 659.25, 'sine', 0.2);
    note(out, t, 0.4, 1318.5, 'sine', 0.03);
    note(out, t + 0.35, 1.1, 493.88, 'sine', 0.2);
    note(out, t + 0.35, 0.6, 987.77, 'sine', 0.03);
  });
}

/** The class has ended: the question chime played downwards (G5 E5 C5), so
 *  the lesson closes on the sound that opened its rounds, resolved. */
export function playClassEndTone(): void {
  playCue(1.4, (out, t) => {
    [783.99, 659.25, 523.25].forEach((freq, i) => {
      note(out, t + i * 0.16, i === 2 ? 0.9 : 0.4, freq, 'triangle', 0.2);
      note(out, t + i * 0.16, 0.25, freq * 2, 'sine', 0.05);
    });
  });
}

/** Stop everything — for leaving the room, where a tone outliving the class
 *  would be worse than one that never played. */
export function stopAllToneLoops(): void {
  for (const name of [...loops.keys()]) stopToneLoop(name);
  stopQuestionTone();
}
