'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type Track as LKTrack,
} from 'livekit-client';
import { PiMicrophone, PiMicrophoneSlash, PiVideoCameraSlash } from 'react-icons/pi';
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
  /** Camera + mic (instructor only). */
  canPublishMedia: boolean;
  /** Screen share (instructor, or a student the instructor granted). */
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
 * students subscribe (their join token is subscribe-only). Kept mounted
 * across the Video/Chalkboard view switch so the call never drops, and its
 * media controls are reported up to the classroom's bottom bar via `onControls`.
 */
export function VideoStage({
  sessionId,
  isInstructor,
  canScreenShare,
  dataSaver,
  onControls,
}: {
  sessionId: string;
  isInstructor: boolean;
  /** Instructor (always) or a student the instructor granted screen-share. */
  canScreenShare: boolean;
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
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

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
        // Ignore disconnects we triggered ourselves (effect teardown / remount in
        // dev). Only a drop while the room is still the live one is a real error.
        .on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus('error');
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
      setStatus('live');
      sync();
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
    };
  }, [sessionId]);

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
    // A granted student is a co-host: mic, camera and screen, same as instructor.
    const canPublish = isInstructor || canScreenShare;
    onControls({
      camOn,
      micOn,
      screenOn,
      toggleCam,
      toggleMic,
      toggleScreen,
      canPublishMedia: canPublish,
      canShareScreen: canPublish,
    });
  }, [
    onControls,
    status,
    camOn,
    micOn,
    screenOn,
    isInstructor,
    canScreenShare,
    toggleCam,
    toggleMic,
    toggleScreen,
  ]);

  // A student whose screen-share grant was revoked must stop publishing.
  useEffect(() => {
    if (isInstructor || canScreenShare) return;
    const room = roomRef.current;
    if (!room || !screenOn) return;
    void room.localParticipant.setScreenShareEnabled(false);
    setScreenOn(false);
  }, [canScreenShare, isInstructor, screenOn]);

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
          <p className="mt-2">Video unavailable</p>
          {error && <p className="mt-1 text-xs text-neutral-500">{error}</p>}
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
    <div className="flex h-full flex-col gap-2">
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
