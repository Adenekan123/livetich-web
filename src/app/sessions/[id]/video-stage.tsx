'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type Track as LKTrack,
} from 'livekit-client';
import { API_URL } from '@/lib/api';
import { getClientToken } from '@/lib/client-token';

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
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
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
    <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-800">
      {tile.camera ? (
        <VideoBox
          track={tile.camera}
          muted={tile.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-2xl text-slate-500">
          {tile.isInstructor ? '🎓' : '👤'}
        </div>
      )}
      {!tile.isLocal && <AudioSink track={tile.mic} />}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.micMuted ? '🔇' : '🎙'} {tile.name}
        {tile.isLocal && ' (you)'}
      </div>
    </div>
  );
}

/**
 * LiveKit video for a session. Instructor publishes camera/mic/screen;
 * students subscribe (their join token is subscribe-only). Kept mounted
 * across the Video/Chalkboard tab switch so the call never drops.
 */
export function VideoStage({
  sessionId,
  isInstructor,
  canScreenShare,
}: {
  sessionId: string;
  isInstructor: boolean;
  /** Instructor (always) or a student the instructor granted screen-share. */
  canScreenShare: boolean;
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
        const res = await fetch(`${API_URL}/sessions/${sessionId}/token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getClientToken() ?? ''}` },
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
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.Disconnected, () => setStatus('error'));

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

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };
  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleScreen = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOn;
    await room.localParticipant.setScreenShareEnabled(next);
    setScreenOn(next);
  };

  // A student whose screen-share grant was revoked must stop publishing.
  useEffect(() => {
    if (isInstructor || canScreenShare) return;
    const room = roomRef.current;
    if (!room || !screenOn) return;
    void room.localParticipant.setScreenShareEnabled(false);
    setScreenOn(false);
  }, [canScreenShare, isInstructor, screenOn]);

  if (status === 'error') {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-900 text-center text-sm text-slate-400">
        <div>
          <p className="text-2xl">📵</p>
          <p className="mt-2">Video unavailable</p>
          {error && <p className="mt-1 text-xs text-slate-500">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {screen && (
        <div className="overflow-hidden rounded-lg bg-black">
          <VideoBox
            track={screen}
            muted
            className="max-h-[60vh] w-full object-contain"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <ParticipantTile key={t.sid} tile={t} />
        ))}
      </div>

      {status === 'connecting' && (
        <p className="text-center text-xs text-slate-500">
          Connecting to video…
        </p>
      )}

      {status === 'live' && (isInstructor || canScreenShare) && (
        <div className="flex flex-wrap justify-center gap-2">
          {isInstructor && (
            <>
              <button
                onClick={toggleCam}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  camOn
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {camOn ? '📹 Camera on' : '📷 Start camera'}
              </button>
              <button
                onClick={toggleMic}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  micOn
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {micOn ? '🎙 Mic on' : '🔇 Start mic'}
              </button>
            </>
          )}
          <button
            onClick={toggleScreen}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              screenOn
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {screenOn ? '🖥 Sharing screen' : '🖥 Share screen'}
          </button>
          {!isInstructor && (
            <span className="self-center text-xs text-slate-500">
              You may share your screen
            </span>
          )}
        </div>
      )}
    </div>
  );
}
