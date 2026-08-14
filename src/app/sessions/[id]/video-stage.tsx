'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type Track as LKTrack,
} from 'livekit-client';
import {
  PiArrowClockwise,
  PiMicrophone,
  PiMicrophoneSlash,
  PiVideoCameraSlash,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';

/** Media controls lifted up to the classroom's bottom bar. */
export interface VideoControls {
  camOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  toggleCam: () => void;
  toggleMic: () => void;
  toggleScreen: () => void;
  /** Camera + mic (everyone). */
  canPublishMedia: boolean;
  /** Screen share (everyone). */
  canShareScreen: boolean;
}

interface Tile {
  sid: string;
  name: string;
  isLocal: boolean;
  isInstructor: boolean;
  camera?: LKTrack;
  mic?: LKTrack;
  micMuted: boolean;
}

/**
 * A LiveKit disconnect is only terminal for some reasons. Reconnect attempts
 * emit `Reconnecting`/`Reconnected` and never reach here; a `Disconnected` means
 * the client gave up (or was closed on purpose). We ignore our own teardown and
 * surface the rest with a human message + a retry affordance.
 */
function disconnectMessage(reason?: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return 'You joined from another tab or device.';
    case DisconnectReason.PARTICIPANT_REMOVED:
      return 'You were removed from the room.';
    case DisconnectReason.SERVER_SHUTDOWN:
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return 'The video session was closed.';
    default:
      return 'Lost connection to the video server.';
  }
}

function roleOf(p: Participant): boolean {
  try {
    return p.metadata
      ? (JSON.parse(p.metadata) as { role?: string }).role === 'INSTRUCTOR'
      : false;
  } catch {
    return false;
  }
}

function tilesFrom(room: Room): { tiles: Tile[]; screen?: LKTrack } {
  const build = (p: Participant, isLocal: boolean): Tile => ({
    sid: p.sid,
    name: p.name || p.identity,
    isLocal,
    isInstructor: roleOf(p),
    camera: p.getTrackPublication(Track.Source.Camera)?.track,
    mic: p.getTrackPublication(Track.Source.Microphone)?.track,
    micMuted: p.getTrackPublication(Track.Source.Microphone)?.isMuted ?? true,
  });

  const all = [
    build(room.localParticipant, true),
    ...[...room.remoteParticipants.values()].map((p) => build(p, false)),
  ];

  // A screen share (from anyone) is promoted to the big stage.
  let screen: LKTrack | undefined;
  for (const p of [
    room.localParticipant,
    ...room.remoteParticipants.values(),
  ]) {
    const s = p.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (s) {
      screen = s;
      break;
    }
  }
  return { tiles: all, screen };
}

/** Attaches a LiveKit track to a video element for its lifetime. */
function VideoBox({
  track,
  muted,
  className,
}: {
  track?: LKTrack;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  if (!track) return null;
  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

/** Hidden sink so a remote participant's mic is audible. */
function AudioSink({ track }: { track?: LKTrack }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  if (!track) return null;
  return <audio ref={ref} autoPlay />;
}

function ParticipantTile({ tile }: { tile: Tile }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-800">
      <VideoBox
        track={tile.camera}
        muted={tile.isLocal}
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.micMuted ? (
          <PiMicrophoneSlash className="h-3.5 w-3.5 text-neutral-300" />
        ) : (
          <PiMicrophone className="h-3.5 w-3.5" />
        )}
        {tile.name}
        {tile.isLocal && ' (you)'}
      </div>
    </div>
  );
}

/**
 * LiveKit video for a session. Instructor publishes camera/mic/screen;
 * everyone (instructor and students) can publish mic/camera/screen. Kept
 * mounted across the Video/Chalkboard view switch so the call never drops, and
 * its media controls are reported up to the classroom's bottom bar via `onControls`.
 */
export function VideoStage({
  sessionId,
  dataSaver,
  onControls,
}: {
  sessionId: string;
  /** Low-bandwidth mode: unsubscribe from all remote video, keep audio. */
  dataSaver: boolean;
  /** Reports the media controls (or null when not live) to the parent. */
  onControls?: (c: VideoControls | null) => void;
}) {
  const roomRef = useRef<Room | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [screen, setScreen] = useState<LKTrack | undefined>();
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>(
    'connecting',
  );
  const [error, setError] = useState<string | null>(null);
  // A brief drop LiveKit is auto-recovering from — the call stays "live" (and
  // controls stay put), we just note it. Only a give-up flips us to `error`.
  const [reconnecting, setReconnecting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  const retry = useCallback(() => {
    setError(null);
    setReconnecting(false);
    setStatus('connecting');
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;

    const sync = () => {
      if (!room) return;
      const { tiles, screen } = tilesFrom(room);
      setTiles(tiles);
      setScreen(screen);
    };

    (async () => {
      let token: string, url: string;
      try {
        const authToken = await getRealtimeToken();
        const res = await fetch(`${API_URL}/sessions/${sessionId}/token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken ?? ''}` },
        });
        if (!res.ok) throw new Error(`token request failed (${res.status})`);
        ({ token, url } = await res.json());
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not get a token');
        }
        return;
      }

      room = new Room({ adaptiveStream: true, dynacast: true });
      room
        .on(RoomEvent.TrackSubscribed, sync)
        .on(RoomEvent.TrackUnsubscribed, sync)
        .on(RoomEvent.TrackPublished, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        // A transient blip: LiveKit is retrying under the hood. Stay "live" so
        // the call and controls don't vanish — just flag it.
        .on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setReconnecting(true);
        })
        .on(RoomEvent.Reconnected, () => {
          if (!cancelled) {
            setReconnecting(false);
            sync();
          }
        })
        // A `Disconnected` is LiveKit giving up (or a deliberate close). Ignore
        // our own teardown (StrictMode remount / leaving); everything else is a
        // real drop the user can retry from — don't strip the whole surface for
        // a recoverable hiccup.
        .on(RoomEvent.Disconnected, (reason) => {
          if (cancelled || reason === DisconnectReason.CLIENT_INITIATED) return;
          setReconnecting(false);
          setError(disconnectMessage(reason));
          setStatus('error');
        });

      try {
        await room.connect(url, token);
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not connect');
        }
        return;
      }
      if (cancelled) {
        room.disconnect();
        return;
      }
      roomRef.current = room;
      setReconnecting(false);
      setError(null);
      setStatus('live');
      sync();
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
    };
  }, [sessionId, retryKey]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, []);
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, []);
  const toggleScreen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(next);
    setScreenOn(next);
  }, []);

  // Report media controls up to the classroom bar (null while not live).
  useEffect(() => {
    if (!onControls) return;
    if (status !== 'live') {
      onControls(null);
      return;
    }
    // Everyone is a co-host now: mic, camera and screen share for all, each
    // starting off. The LiveKit join token grants publish to students too.
    onControls({
      camOn,
      micOn,
      screenOn,
      toggleCam,
      toggleMic,
      toggleScreen,
      canPublishMedia: true,
      canShareScreen: true,
    });
  }, [
    onControls,
    status,
    camOn,
    micOn,
    screenOn,
    toggleCam,
    toggleMic,
    toggleScreen,
  ]);

  // Data-saver: unsubscribe from every remote video track (camera + screen) so
  // nothing downloads; audio stays. Re-applied when toggled or tracks change.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === Track.Kind.Video) pub.setSubscribed(!dataSaver);
      }
    }
  }, [dataSaver, tiles]);

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-neutral-900 text-center text-sm text-neutral-400">
        <div>
          <PiVideoCameraSlash className="mx-auto h-8 w-8 text-neutral-500" />
          <p className="mt-2 font-semibold text-white">Video unavailable</p>
          <p className="mt-1 text-xs text-neutral-500">
            {error ?? 'Lost connection to the video server.'}
          </p>
          <button
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-white/20"
          >
            <PiArrowClockwise className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Data saver: no video downloads at all — audio keeps playing, and the
  // chalkboard (tiny) carries the teaching. The big local differentiator.
  if (dataSaver) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-6 text-center">
        {tiles
          .filter((t) => !t.isLocal)
          .map((t) => (
            <AudioSink key={`${t.sid}-audio`} track={t.mic} />
          ))}
        <PiVideoCameraSlash className="h-8 w-8 text-neutral-500" aria-hidden />
        <p className="text-sm font-semibold text-white">Data saver is on</p>
        <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
          Video is off to save data — audio and the chalkboard are still live.
          Turn it off in the controls to see video.
        </p>
      </div>
    );
  }

  // Only participants actually on camera get a tile — no empty avatar boxes.
  const camTiles = tiles.filter((t) => t.camera);

  return (
    <div className="relative flex h-full flex-col gap-2">
      {reconnecting && (
        <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500/90 px-3.5 py-1.5 text-xs font-semibold text-amber-950 shadow-lg">
          <PiArrowClockwise className="h-3.5 w-3.5 animate-spin" />
          Reconnecting…
        </div>
      )}
      {/* Audio for every remote participant, independent of whether they show a
          tile — so a camera-off speaker is still heard. */}
      {tiles
        .filter((t) => !t.isLocal)
        .map((t) => (
          <AudioSink key={`${t.sid}-audio`} track={t.mic} />
        ))}

      {screen && (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
          <VideoBox
            track={screen}
            muted
            className="h-full w-full object-contain"
          />
        </div>
      )}

      {camTiles.length > 0 ? (
        <div
          className={
            screen
              ? 'grid auto-cols-[9rem] grid-flow-col gap-2 overflow-x-auto'
              : 'grid flex-1 auto-rows-min content-start gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {camTiles.map((t) => (
            <ParticipantTile key={t.sid} tile={t} />
          ))}
        </div>
      ) : (
        !screen && (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            {status === 'connecting'
              ? 'Connecting to video…'
              : 'No one is on camera yet.'}
          </div>
        )
      )}
    </div>
  );
}
