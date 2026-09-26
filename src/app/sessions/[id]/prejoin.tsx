'use client';

/**
 * THESIS: the door to a live class, where you find out your microphone works
 * before thirty people are listening. Refuses the category default of a dark
 * video-call lobby with a floating control bar.
 * OWN-WORLD: white ground, deep-teal ink, one teal pair. Broadcast rings —
 * hairline concentric circles in signal-300, tight at the preview and opening
 * out, fading to white under the reading column. Pill controls,
 * hairline-divided device rows, no cards stacked in cards.
 * STORY: I can see myself, I can see the room hears me, I press one button.
 * FIRST VIEWPORT: preview left at 16:9 with the two big toggles beneath it;
 * right column carries the live chip, the class name, the three device rows and
 * a full-width Join. Nothing below the fold on a laptop.
 * FORM: precisely-specified Operate surface, shaped directly — no concept roll.
 * The signature is that the rings ARE the level meter: they breathe with your
 * voice, so "can they hear me" is answered by the page itself.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { BroadcastRings } from '@/components/broadcast-rings';
import { Wordmark } from '@/components/logo';
import { btn, cn, initials } from '@/lib/ui';
import {
  readMediaPrefs,
  writeMediaPrefs,
  type MediaPrefs,
} from '@/lib/media-prefs';

type Phase = 'requesting' | 'ready' | 'denied' | 'unavailable';

interface Device {
  deviceId: string;
  label: string;
}

/** `setSinkId` is not in the DOM lib everywhere, and is absent in Firefox. */
type SinkCapableAudio = HTMLAudioElement & {
  setSinkId?: (id: string) => Promise<void>;
};

/** Chrome and Edge let a page choose the output; Firefox and Safari do not. */
function canChooseSpeaker(): boolean {
  return (
    typeof window !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
  );
}

/** The raw request, kept out of the component so the "that device is gone,
 *  try the default" retry is a second call rather than a recursion. */
function openStream(
  cameraId: string | null,
  micId: string | null,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: cameraId ? { deviceId: { exact: cameraId } } : true,
    audio: micId ? { deviceId: { exact: micId } } : true,
  });
}

/** A store that never emits: the answer cannot change within a page load. */
const NEVER_CHANGES = () => () => {};

function errorName(e: unknown): string {
  return e instanceof DOMException ? e.name : '';
}

/**
 * Our words for what went wrong, never the browser's.
 *
 * `getUserMedia` rejects with strings like "Not supported" and "Could not
 * start video source", which name an internal condition and no way out of it.
 * A student reads one sentence here and needs it to tell them what to do.
 */
function explain(name: string): string {
  switch (name) {
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Another app is using your camera or microphone. Close it, then reload this page — or join now and turn them on later.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera or microphone was found on this device. You can still join and watch.';
    default:
      return 'This browser could not reach your camera or microphone. You can still join and watch — or try again in Chrome, Edge, Firefox or Safari.';
  }
}

/** Browser labels are empty until permission lands; fall back to a number. */
function labelled(devices: MediaDeviceInfo[], noun: string): Device[] {
  return devices.map((d, i) => ({
    deviceId: d.deviceId,
    label: d.label || `${noun} ${i + 1}`,
  }));
}

/** A remembered device that is no longer plugged in is a hint, not a promise. */
function resolveId(preferred: string | null, devices: Device[]): string | null {
  if (preferred && devices.some((d) => d.deviceId === preferred)) {
    return preferred;
  }
  return devices[0]?.deviceId ?? null;
}

export function PreJoin({
  courseTitle,
  displayName,
  live,
  teaching,
  onJoin,
}: {
  courseTitle: string;
  displayName: string;
  /** Whether the room is already running, for the status chip. */
  live: boolean;
  /** Instructors get the copy that says the class is waiting on them. */
  teaching: boolean;
  onJoin: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('requesting');
  const [prefs, setPrefs] = useState<MediaPrefs>(() => readMediaPrefs());
  const [cameras, setCameras] = useState<Device[]>([]);
  const [mics, setMics] = useState<Device[]>([]);
  const [speakers, setSpeakers] = useState<Device[]>([]);
  // Latches once, so the reassurance stays put instead of flickering with the
  // level. It is the answer to "can they hear me", which only needs saying once.
  const [heard, setHeard] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  // The level is written straight to the DOM. Putting it through React state
  // would re-render the whole screen sixty times a second to move one bar.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);

  // Settled on the client only: the check touches `HTMLMediaElement`, which
  // does not exist while rendering on the server. The server snapshot is
  // `false`, so the row appears with hydration rather than mismatching it.
  const speakerChoiceAvailable = useSyncExternalStore(
    NEVER_CHANGES,
    canChooseSpeaker,
    () => false,
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Ask for the devices, then read what is actually attached. */
  const acquire = useCallback(
    async (
      cameraId: string | null,
      micId: string | null,
      cameraOn: boolean,
    ) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('unavailable');
        return;
      }
      stopStream();

      let stream: MediaStream;
      try {
        stream = await openStream(cameraId, micId);
      } catch (e) {
        const name = errorName(e);
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setPhase('denied');
          return;
        }
        const missing =
          name === 'NotFoundError' || name === 'OverconstrainedError';
        if (!missing || (!cameraId && !micId)) {
          setPhase('unavailable');
          setProblem(explain(name));
          return;
        }
        // A remembered device that is no longer plugged in. Take whatever is
        // here instead of holding the student at a dead screen.
        try {
          stream = await openStream(null, null);
        } catch (retry) {
          setPhase(
            errorName(retry) === 'NotAllowedError' ? 'denied' : 'unavailable',
          );
          return;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const track = stream.getVideoTracks()[0];
      if (track) track.enabled = cameraOn;

      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = labelled(
        all.filter((d) => d.kind === 'videoinput'),
        'Camera',
      );
      const ins = labelled(
        all.filter((d) => d.kind === 'audioinput'),
        'Microphone',
      );
      const outs = labelled(
        all.filter((d) => d.kind === 'audiooutput'),
        'Speaker',
      );
      setCameras(cams);
      setMics(ins);
      setSpeakers(outs);
      setPrefs((p) => ({
        ...p,
        cameraDeviceId: resolveId(cameraId ?? p.cameraDeviceId, cams),
        micDeviceId: resolveId(micId ?? p.micDeviceId, ins),
        speakerDeviceId: resolveId(p.speakerDeviceId, outs),
      }));
      setProblem(null);
      setPhase('ready');
    },
    [stopStream],
  );

  // First run: ask once, using whatever this browser remembered.
  useEffect(() => {
    const saved = readMediaPrefs();
    // Deferred so the first state write is not synchronous inside the effect.
    const t = setTimeout(() => {
      void acquire(saved.cameraDeviceId, saved.micDeviceId, saved.cameraOn);
    }, 0);
    return () => {
      clearTimeout(t);
      stopStream();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [acquire, stopStream]);

  // The meter, and the rings it drives.
  useEffect(() => {
    if (phase !== 'ready') return;
    const stream = streamRef.current;
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track) return;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = audioCtxRef.current ?? new Ctor();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      // Peak deviation from silence, which tracks speech better than RMS at
      // these buffer sizes and does not need a log curve to feel right.
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = Math.abs(buffer[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      const level = Math.min(1, peak * 2.2);
      // Rise fast, fall slow: a meter that drops instantly reads as broken.
      smoothed = level > smoothed ? level : smoothed * 0.86 + level * 0.14;

      const shown = smoothed.toFixed(3);
      meterRef.current?.style.setProperty('--level', shown);
      stageRef.current?.style.setProperty('--voice', shown);
      if (smoothed > 0.08) setHeard(true);

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // Already torn down with the context.
      }
    };
  }, [phase, prefs.micDeviceId]);

  const toggleCamera = useCallback(() => {
    setPrefs((p) => {
      const next = !p.cameraOn;
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) track.enabled = next;
      return writeMediaPrefs({ cameraOn: next });
    });
  }, []);

  const toggleMic = useCallback(() => {
    setPrefs((p) => writeMediaPrefs({ micOn: !p.micOn }));
  }, []);

  const chooseCamera = useCallback(
    (id: string) => {
      setPrefs(writeMediaPrefs({ cameraDeviceId: id }));
      void acquire(id, prefs.micDeviceId, prefs.cameraOn);
    },
    [acquire, prefs.cameraOn, prefs.micDeviceId],
  );

  const chooseMic = useCallback(
    (id: string) => {
      setPrefs(writeMediaPrefs({ micDeviceId: id }));
      setHeard(false);
      void acquire(prefs.cameraDeviceId, id, prefs.cameraOn);
    },
    [acquire, prefs.cameraDeviceId, prefs.cameraOn],
  );

  const chooseSpeaker = useCallback((id: string) => {
    setPrefs(writeMediaPrefs({ speakerDeviceId: id }));
  }, []);

  /** A short tone through the chosen output — the only way to test it. */
  const testSpeaker = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioCtxRef.current ?? new Ctor();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Two soft notes rather than one flat beep, so it is recognisable as a
      // test and not as an error sound.
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      osc.connect(gain).connect(dest);

      const el = new Audio() as SinkCapableAudio;
      el.srcObject = dest.stream;
      if (prefs.speakerDeviceId && el.setSinkId) {
        try {
          await el.setSinkId(prefs.speakerDeviceId);
        } catch {
          // Output locked to the system default; the tone still plays.
        }
      }
      await el.play();
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      await new Promise((r) => setTimeout(r, 600));
      el.pause();
      el.srcObject = null;
    } catch {
      setProblem('That speaker did not accept the test tone.');
    } finally {
      setTesting(false);
    }
  }, [prefs.speakerDeviceId, testing]);

  const join = useCallback(() => {
    writeMediaPrefs(prefs);
    stopStream();
    onJoin();
  }, [onJoin, prefs, stopStream]);

  const ready = phase === 'ready';

  return (
    <main
      ref={stageRef}
      style={{ '--voice': 0 } as React.CSSProperties}
      className="relative isolate min-h-dvh overflow-hidden bg-white"
    >
      <BroadcastRings />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:pt-8">
        <Wordmark className="h-7 text-neutral-950" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col justify-center gap-10 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:py-12">
        {/* Preview */}
        <div className="lg:flex-[1.35]">
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                'h-full w-full scale-x-[-1] object-cover transition-opacity duration-300',
                ready && prefs.cameraOn ? 'opacity-100' : 'opacity-0',
              )}
            />

            {(!ready || !prefs.cameraOn) && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-signal-700 font-display text-2xl font-bold text-white">
                    {initials(displayName)}
                  </span>
                  <p className="text-sm text-neutral-300">
                    {phase === 'requesting'
                      ? 'Waiting for your camera…'
                      : phase === 'denied'
                        ? 'Camera and microphone are blocked'
                        : phase === 'unavailable'
                          ? 'No camera found'
                          : 'Your camera is off'}
                  </p>
                </div>
              </div>
            )}

            <p className="absolute bottom-3 left-3 rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {displayName}
            </p>
          </div>

          {/* The two decisions you make with your hands, not a menu. */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Toggle
              on={prefs.cameraOn}
              disabled={!ready}
              onClick={toggleCamera}
              onLabel="Camera on"
              offLabel="Camera off"
              icon={<CameraIcon off={!prefs.cameraOn} />}
            />
            <Toggle
              on={prefs.micOn}
              disabled={!ready}
              onClick={toggleMic}
              onLabel="Mic on"
              offLabel="Mic off"
              icon={<MicIcon off={!prefs.micOn} />}
            />

            <div className="flex min-w-32 flex-1 items-center gap-2">
              <div
                ref={meterRef}
                style={{ '--level': 0 } as React.CSSProperties}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
                role="meter"
                aria-label="Microphone level"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={heard ? 100 : 0}
              >
                {/* Scaled, not resized: this moves sixty times a second, and
                    animating width would relayout the row on every frame. */}
                <div
                  className="h-full w-full origin-left rounded-full bg-signal-600"
                  style={{
                    transform: 'scaleX(var(--level))',
                    transition: 'transform 60ms linear',
                  }}
                />
              </div>
              <p
                aria-live="polite"
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  heard ? 'text-signal-700' : 'text-neutral-500',
                )}
              >
                {!heard
                  ? 'Say something'
                  : prefs.micOn
                    ? 'We can hear you'
                    : "Mic works — you'll join muted"}
              </p>
            </div>
          </div>
        </div>

        {/* Class, devices, and the button */}
        <div className="lg:flex-1">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-600" />
                Live now
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700 ring-1 ring-signal-200">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-600" />
                Not started yet
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-4xl">
            {courseTitle}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {teaching
              ? 'Your class is waiting on you. Check your camera and microphone, then open the room.'
              : live
                ? 'Class is in progress. Check yourself over, then join.'
                : 'You can set up now — the room opens when your instructor arrives.'}
          </p>

          <div className="mt-7 divide-y divide-neutral-200 border-y border-neutral-200">
            <DeviceRow
              label="Camera"
              value={prefs.cameraDeviceId}
              devices={cameras}
              disabled={!ready}
              onChange={chooseCamera}
            />
            <DeviceRow
              label="Microphone"
              value={prefs.micDeviceId}
              devices={mics}
              disabled={!ready}
              onChange={chooseMic}
            />
            {speakerChoiceAvailable && (
              <DeviceRow
                label="Speaker"
                value={prefs.speakerDeviceId}
                devices={speakers}
                disabled={!ready}
                onChange={chooseSpeaker}
                action={
                  <button
                    type="button"
                    onClick={() => void testSpeaker()}
                    disabled={testing}
                    className={btn('secondary', 'sm')}
                  >
                    {testing ? 'Playing…' : 'Test'}
                  </button>
                }
              />
            )}
          </div>

          {phase === 'denied' && (
            <p className="mt-4 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-800 ring-1 ring-accent-200">
              Your browser is blocking the camera and microphone. Open the
              padlock beside the web address, allow them, then reload this page.
              You can still join and turn them on later.
            </p>
          )}
          {phase === 'unavailable' && (
            <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 ring-1 ring-neutral-200">
              {problem ?? explain('NotFoundError')}
            </p>
          )}

          <button
            type="button"
            onClick={join}
            className={btn('primary', 'xl', 'mt-6 w-full')}
          >
            {teaching ? 'Open the room' : 'Join class'}
          </button>

          <Link
            href="/dashboard"
            className={btn('ghost', 'md', 'mt-2 w-full')}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function Toggle({
  on,
  disabled,
  onClick,
  onLabel,
  offLabel,
  icon,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:pointer-events-none disabled:opacity-50',
        on
          ? 'bg-signal-700 text-white hover:bg-signal-800 focus-visible:ring-signal-500'
          : 'border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 focus-visible:ring-neutral-400',
      )}
    >
      {icon}
      {on ? onLabel : offLabel}
    </button>
  );
}

function DeviceRow({
  label,
  value,
  devices,
  disabled,
  onChange,
  action,
}: {
  label: string;
  value: string | null;
  devices: Device[];
  disabled: boolean;
  onChange: (id: string) => void;
  action?: React.ReactNode;
}) {
  const id = `device-${label.toLowerCase()}`;
  return (
    <div className="flex items-center gap-3 py-3">
      <label
        htmlFor={id}
        className="w-24 shrink-0 text-sm font-medium text-neutral-700"
      >
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled || devices.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15 disabled:bg-neutral-50 disabled:text-neutral-400"
      >
        {devices.length === 0 ? (
          <option value="">None found</option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))
        )}
      </select>
      {action}
    </div>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4 7.5h9A1.5 1.5 0 0 1 14.5 9v6a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15V9A1.5 1.5 0 0 1 4 7.5Zm10.5 3.2 5-2.7v8l-5-2.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {off && (
        <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M12 3.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {off && (
        <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
