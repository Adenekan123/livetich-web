'use client';

import { useEffect, useRef, useState } from 'react';
import {
  VIDEO_DRIFT_TOLERANCE,
  YT_PLAYING,
  expectedTime,
  loadYouTubeApi,
  type VideoState,
  type YouTubePlayer,
} from './board-video';

/**
 * A YouTube embed the whole room watches together.
 *
 * The instructor's player is the clock: whenever it starts, stops or jumps, and
 * on a slow heartbeat, its position goes out over the board's awareness channel.
 * Followers hold their own player against it, correcting only when they have
 * drifted far enough to notice — a seek re-buffers, so chasing every fraction of
 * a second would stutter worse than the drift it fixed.
 */
export function BoardVideoEmbed({
  elementId,
  videoId,
  canControl,
  state,
  onBroadcast,
}: {
  elementId: string;
  videoId: string;
  /** The instructor drives; everyone else follows. */
  canControl: boolean;
  /** Latest state from the instructor, for followers. */
  state: VideoState | null;
  onBroadcast: (state: VideoState) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [failed, setFailed] = useState(false);
  /** Followers: set while we are applying the instructor's state, so our own
   *  player events are not mistaken for someone taking control. */
  const applyingRef = useRef(false);
  // The player is built once and lives outside React's render cycle, so the
  // values its callbacks need are mirrored into refs rather than captured.
  const latestRef = useRef<VideoState | null>(state);
  const canControlRef = useRef(canControl);
  const broadcastRef = useRef(onBroadcast);
  useEffect(() => {
    latestRef.current = state;
    canControlRef.current = canControl;
    broadcastRef.current = onBroadcast;
  }, [state, canControl, onBroadcast]);

  useEffect(() => {
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    void loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            // Followers never drive, so hide controls that would fight the
            // instructor; the instructor keeps a full player.
            controls: canControlRef.current ? 1 : 0,
            disablekb: canControlRef.current ? 0 : 1,
          },
          events: {
            onReady: ({ target }) => {
              playerRef.current = target;
              // Test hook, like the board's. The player lives inside a
              // cross-origin iframe, so a test cannot reach it any other way.
              const w = window as unknown as {
                __livetichVideo?: Map<string, YouTubePlayer>;
              };
              w.__livetichVideo ??= new Map();
              w.__livetichVideo.set(elementId, target);
              // A follower joining mid-video starts where the room already is.
              const s = latestRef.current;
              if (!canControlRef.current && s && s.elementId === elementId) {
                applyingRef.current = true;
                target.seekTo(expectedTime(s), true);
                if (s.playing) target.playVideo();
                applyingRef.current = false;
              }
            },
            onStateChange: ({ target, data }) => {
              if (!canControlRef.current || applyingRef.current) return;
              // Play, pause and seek all surface here; send the position with
              // the moment it was read so followers can allow for the trip.
              broadcastRef.current({
                elementId,
                playing: data === YT_PLAYING,
                time: target.getCurrentTime(),
                at: Date.now(),
              });
            },
          },
        });

        // A heartbeat while playing: scrubbing inside the progress bar does not
        // always raise a state change, and a follower who buffers needs a fresh
        // reference to catch up to.
        heartbeat = setInterval(() => {
          const p = playerRef.current;
          if (!p || !canControlRef.current) return;
          if (p.getPlayerState() !== YT_PLAYING) return;
          broadcastRef.current({
            elementId,
            playing: true,
            time: p.getCurrentTime(),
            at: Date.now(),
          });
        }, 2000);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      (
        window as unknown as { __livetichVideo?: Map<string, YouTubePlayer> }
      ).__livetichVideo?.delete(elementId);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, elementId]);

  // Followers: hold position against the instructor.
  useEffect(() => {
    if (canControl || !state || state.elementId !== elementId) return;
    const player = playerRef.current;
    if (!player) return;
    applyingRef.current = true;
    try {
      const target = expectedTime(state);
      if (Math.abs(player.getCurrentTime() - target) > VIDEO_DRIFT_TOLERANCE) {
        player.seekTo(target, true);
      }
      const playing = player.getPlayerState() === YT_PLAYING;
      if (state.playing && !playing) player.playVideo();
      if (!state.playing && playing) player.pauseVideo();
    } finally {
      applyingRef.current = false;
    }
  }, [state, canControl, elementId]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-neutral-900 p-4 text-center text-xs text-neutral-300">
        This video could not be loaded.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-black">
      {/* Replaced by the YouTube iframe once the API is ready. */}
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
