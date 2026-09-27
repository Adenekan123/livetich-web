'use client';

/**
 * THESIS: the door to a live class, where you find out your microphone works
 * before thirty people are listening. Refuses the category default of a dark
 * video-call lobby with a floating control bar.
 * WORLD: a quiet near-white ground with two soft teal washes at the corners,
 * the Livetich wordmark top-left, and nothing else competing with the preview.
 * The preview sits in a white frame; the device rows are tall, calm selects.
 * STORY: I can see myself, I can see the room hears me, I press one button.
 * FIRST VIEWPORT: preview left at 16:9 with the two toggles beneath it; right
 * column carries the live chip, the class name, the device rows and a
 * full-width Join. Nothing below the fold on a laptop; stacked on a phone.
 * The Camera / Mic chevrons open that device's picker, so switching a headset
 * is one tap from the control you are already looking at.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
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

/**
 * Open a device select's own menu from somewhere else on the page (the
 * chevrons on the Camera / Mic pills). `showPicker` needs a user gesture, which
 * a click is; where it is missing or refused, bring the select into view and
 * focus it so the keyboard or a second tap opens it.
 */
function openPicker(id: string) {
  const el = document.getElementById(id) as
    (HTMLSelectElement & { showPicker?: () => void }) | null;
  if (!el || el.disabled) return;
  try {
    if (el.showPicker) {
      el.showPicker();
      return;
    }
  } catch {
    // Fall through to focusing it.
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus();
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

  // The level meter.
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

      meterRef.current?.style.setProperty('--level', smoothed.toFixed(3));
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
    <main className="relative isolate min-h-dvh overflow-hidden bg-neutral-50">
      {/* Two soft teal washes at the corners — the only decoration, and
          quiet enough that the preview stays the brightest thing here. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-64 -right-48 -z-10 h-[36rem] w-[36rem] rounded-full bg-signal-50/80 sm:-top-72 sm:-right-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-72 -left-56 -z-10 h-[34rem] w-[34rem] rounded-full bg-signal-50/60"
      />

      <header className="mx-auto w-full max-w-360 px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Link
          href="/dashboard"
          aria-label="Livetich — go to dashboard"
          className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-signal-600 focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-50 focus-visible:outline-none"
        >
          {/* logo-daek.png is 397×260 with the wordmark at (1,89)–(343,160):
              mostly transparent padding. Crop to the wordmark so it sits on
              the content edge at a readable size (24px tall, 30px from sm). */}
          <span className="block h-6 w-29 overflow-hidden sm:h-7.5 sm:w-36.25">
            <BrandLogo className="-mt-7.5 h-22 max-w-none sm:mt-[-37.6px] sm:h-27.5" />
          </span>
        </Link>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-360 flex-col justify-center gap-6 px-4 pt-4 pb-8 sm:gap-8 sm:px-6 sm:pb-10 lg:min-h-[calc(100dvh-7rem)] lg:flex-row lg:items-center lg:gap-16 lg:px-10 lg:py-12 xl:gap-20">
        {/* Preview. `--level` lives here so both the desktop meter and the
            phone's mic button can read it. */}
        <div
          ref={meterRef}
          style={{ '--level': 0 } as React.CSSProperties}
          className="min-w-0 lg:flex-[1.25]"
        >
          <div className="rounded-[1.4rem] bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,46,42,0.35)] ring-1 ring-neutral-200/80 sm:rounded-[1.6rem]">
            {/* Portrait on a phone, as a phone camera frames you; capped so
                the title and Join still fit on a short screen. */}
            <div className="relative aspect-[4/5] max-h-[52dvh] w-full overflow-hidden rounded-2xl bg-neutral-900 sm:aspect-video sm:max-h-none sm:rounded-[1.2rem]">
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
                // Bottom padding on phones keeps the message clear of the
                // round controls laid over the bottom of the frame.
                <div className="absolute inset-0 grid place-items-center pb-16 sm:pb-0">
                  <div className="flex flex-col items-center gap-3 px-4 text-center sm:gap-4">
                    <span className="grid h-20 w-20 place-items-center rounded-full bg-signal-700 text-2xl font-bold text-white sm:h-24 sm:w-24 sm:text-3xl">
                      {initials(displayName)}
                    </span>
                    <p className="text-sm text-white/90 sm:text-base">
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

              <p className="absolute top-3 left-3 max-w-[70%] truncate rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm sm:top-auto sm:bottom-4 sm:left-4 sm:px-3.5 sm:py-1.5 sm:text-sm">
                {displayName}
              </p>

              {/* Phones: the two toggles live on the preview, as in a phone
                  video call. No device menus — the phone picks those. */}
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4 sm:hidden">
                <RoundToggle
                  on={prefs.micOn}
                  disabled={!ready}
                  onClick={toggleMic}
                  label={
                    prefs.micOn ? 'Turn microphone off' : 'Turn microphone on'
                  }
                  icon={<MicIcon off={!prefs.micOn} />}
                  speaking={prefs.micOn}
                />
                <RoundToggle
                  on={prefs.cameraOn}
                  disabled={!ready}
                  onClick={toggleCamera}
                  label={prefs.cameraOn ? 'Turn camera off' : 'Turn camera on'}
                  icon={<CameraIcon off={!prefs.cameraOn} />}
                />
              </div>
            </div>
          </div>

          {/* The two decisions you make with your hands, not a menu. */}
          <div className="mt-6 hidden flex-wrap items-center gap-3 sm:flex">
            <Toggle
              on={prefs.cameraOn}
              disabled={!ready}
              onClick={toggleCamera}
              onChoose={() => openPicker('device-camera')}
              chooseLabel="Choose camera"
              onLabel="Camera on"
              offLabel="Camera off"
              icon={<CameraIcon off={!prefs.cameraOn} />}
            />
            <Toggle
              on={prefs.micOn}
              disabled={!ready}
              onClick={toggleMic}
              onChoose={() => openPicker('device-microphone')}
              chooseLabel="Choose microphone"
              onLabel="Mic on"
              offLabel="Mic off"
              icon={<MicIcon off={!prefs.micOn} />}
            />

            <div className="flex w-full min-w-40 items-center gap-3 sm:w-auto sm:flex-1 sm:pl-2">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200"
                role="meter"
                aria-label="Microphone level"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={heard ? 100 : 0}
              >
                {/* Scaled, not resized: this moves sixty times a second, and
                    animating width would relayout the row on every frame. */}
                <div
                  className="h-full w-full origin-left rounded-full bg-emerald-500"
                  style={{
                    transform: 'scaleX(var(--level))',
                    transition: 'transform 60ms linear',
                  }}
                />
              </div>
              <p
                aria-live="polite"
                className={cn(
                  'text-sm font-medium whitespace-nowrap',
                  heard ? 'text-emerald-700' : 'text-neutral-500',
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

        {/* Class, devices, and the button. On a phone: chip, name, Join. */}
        <div className="min-w-0 text-center sm:text-left lg:flex-1">
          {live ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3.5 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-600" />
              Live now
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-signal-50 px-3.5 py-1.5 text-sm font-semibold text-signal-700 ring-1 ring-signal-200">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-600" />
              Not started yet
            </span>
          )}

          <h1 className="mt-3 font-sans! text-2xl leading-tight font-bold tracking-[-0.02em] text-balance text-neutral-950 sm:mt-5 sm:text-4xl lg:text-5xl">
            {courseTitle}
          </h1>
          <p className="mt-3 hidden max-w-prose text-lg text-pretty text-neutral-500 sm:block">
            {teaching
              ? 'Your class is waiting on you. Check your camera and microphone, then open the room.'
              : live
                ? 'Class is in progress. Check yourself over, then join.'
                : 'You can set up now — the room opens when your instructor arrives.'}
          </p>

          <div className="mt-8 hidden space-y-4 sm:block">
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
                    className="h-12 shrink-0 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 transition duration-150 ease-out hover:border-signal-300 hover:text-signal-800 focus-visible:ring-2 focus-visible:ring-signal-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 sm:h-14 sm:px-6 sm:text-base"
                  >
                    {testing ? 'Playing…' : 'Test'}
                  </button>
                }
              />
            )}
          </div>

          {phase === 'denied' && (
            <p className="mt-5 rounded-xl bg-accent-50 px-4 py-3 text-left text-sm text-accent-800 ring-1 ring-accent-200">
              Your browser is blocking the camera and microphone. Open the
              padlock beside the web address, allow them, then reload this page.
              You can still join and turn them on later.
            </p>
          )}
          {phase === 'unavailable' && (
            <p className="mt-5 rounded-xl bg-white px-4 py-3 text-left text-sm text-neutral-600 ring-1 ring-neutral-200">
              {problem ?? explain('NotFoundError')}
            </p>
          )}

          <button
            type="button"
            onClick={join}
            className="group mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-signal-700 px-6 text-base font-semibold text-white shadow-[0_12px_24px_-14px_rgba(15,118,110,0.7)] transition duration-150 ease-out hover:bg-signal-800 focus-visible:ring-2 focus-visible:ring-signal-600 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 focus-visible:outline-none active:translate-y-px sm:mt-8 sm:h-15 sm:text-lg"
          >
            {teaching ? 'Open the room' : 'Join class'}
            <ArrowIcon />
          </button>

          <Link
            href="/dashboard"
            className={btn(
              'ghost',
              'md',
              'mt-3 w-full text-neutral-500 hover:text-neutral-800 sm:mt-4',
            )}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * A pill with two targets: the body toggles the device, the chevron opens the
 * device picker. Split rather than one button so a tap on "Mic on" never
 * surprises anyone with a menu, and the menu is still one tap away.
 */
function Toggle({
  on,
  disabled,
  onClick,
  onChoose,
  chooseLabel,
  onLabel,
  offLabel,
  icon,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  onChoose: () => void;
  chooseLabel: string;
  onLabel: string;
  offLabel: string;
  icon: React.ReactNode;
}) {
  const part = cn(
    'inline-flex h-12 items-center transition duration-150 ease-out sm:h-14',
    'focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 focus-visible:outline-none',
    'disabled:pointer-events-none',
    on
      ? 'text-white hover:bg-signal-800 focus-visible:ring-signal-600'
      : 'text-neutral-800 hover:bg-neutral-50 focus-visible:ring-neutral-400',
  );
  return (
    <div
      className={cn(
        'inline-flex overflow-hidden rounded-full text-sm font-semibold sm:text-base',
        on
          ? 'bg-signal-700'
          : 'border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,46,42,0.04)]',
        disabled && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={on}
        className={cn(part, 'gap-2.5 rounded-l-full pr-1.5 pl-4 sm:pl-5')}
      >
        {icon}
        {on ? onLabel : offLabel}
      </button>
      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        aria-label={chooseLabel}
        className={cn(part, 'rounded-r-full pr-3.5 pl-1.5 sm:pr-4')}
      >
        <ChevronIcon className="h-4 w-4 opacity-80" />
      </button>
    </div>
  );
}

/**
 * The phone's toggle: a round button on the preview. Off is solid red so it
 * reads at a glance, as in any phone call. With `speaking`, the outline swells
 * with the mic level — the page's "we can hear you" on a screen too small for
 * a meter.
 */
function RoundToggle({
  on,
  disabled,
  onClick,
  label,
  icon,
  speaking = false,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  speaking?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      style={
        speaking && on
          ? {
              boxShadow:
                '0 0 0 calc(var(--level, 0) * 7px) rgba(52, 211, 153, 0.55)',
              transition: 'box-shadow 60ms linear',
            }
          : undefined
      }
      className={cn(
        'grid h-14 w-14 place-items-center rounded-full text-white [&>svg]:h-6 [&>svg]:w-6',
        'focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:outline-none',
        'active:scale-95 disabled:opacity-50',
        on
          ? 'border border-white/50 bg-neutral-950/35 backdrop-blur-md'
          : 'bg-rose-600',
      )}
    >
      {icon}
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
    // Label above the select on phones, so a long device name gets the full
    // width; beside it from sm, as in the desktop layout.
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label
        htmlFor={id}
        className="shrink-0 text-sm font-medium text-neutral-700 sm:w-28 sm:text-base"
      >
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <select
            id={id}
            value={value ?? ''}
            disabled={disabled || devices.length === 0}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-full appearance-none truncate rounded-xl border border-neutral-200 bg-white pr-11 pl-4 text-base text-neutral-900 shadow-[0_1px_2px_rgba(15,46,42,0.04)] transition hover:border-neutral-300 focus:border-signal-600 focus:ring-4 focus:ring-signal-600/15 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 sm:h-14 sm:pl-5"
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
          <ChevronIcon className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-neutral-600" />
        </div>
        {action}
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 10h11.5M11 5.5 15.5 10 11 14.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 7.5h9A1.5 1.5 0 0 1 14.5 9v6a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15V9A1.5 1.5 0 0 1 4 7.5Zm10.5 3.2 5-2.7v8l-5-2.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {off && (
        <path
          d="m3 3 18 18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M12 3.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {off && (
        <path
          d="m3 3 18 18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
