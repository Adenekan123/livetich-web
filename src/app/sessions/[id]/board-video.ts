/**
 * Synchronised video playback for board embeds.
 *
 * Excalidraw renders an embed as a plain iframe, which cannot be controlled
 * from outside it — so a shared video played independently on every screen.
 * For YouTube we render our own iframe instead (see `renderEmbeddable`) with
 * `enablejsapi=1`, which gives us a player object: the instructor's play, pause
 * and seek can then be broadcast, and every follower kept on the same frame.
 *
 * Only YouTube is handled. A generic iframe exposes no player API, so there is
 * nothing to synchronise — those embeds keep Excalidraw's own rendering.
 */

/** What the instructor broadcasts. Ephemeral — it rides awareness, not the doc. */
export interface VideoState {
  /** The embed element this describes. */
  elementId: string;
  playing: boolean;
  /** Playhead in seconds at the moment this was sampled. */
  time: number;
  /** Epoch ms when it was sampled, so followers can account for the trip. */
  at: number;
}

/**
 * Where a follower stops correcting. Below this, seeking would be more
 * disruptive than the drift: a seek re-buffers and stutters, and a second or so
 * of skew on a lecture video is imperceptible.
 */
export const VIDEO_DRIFT_TOLERANCE = 1.5;

/** YouTube's player states, as numbers on the wire. */
export const YT_PLAYING = 1;
export const YT_PAUSED = 2;

export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    host: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YouTubePlayer }) => void;
        onStateChange?: (e: { target: YouTubePlayer; data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * The video id from any of YouTube's link shapes — youtu.be short links,
 * /watch?v=, /embed/ and /live/. Returns null for anything else, which is the
 * signal to leave the embed alone.
 */
export function youTubeIdOf(link: string | null | undefined): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }
  const v = url.searchParams.get('v');
  if (v) return v;
  const m = /^\/(embed|live|shorts)\/([^/?]+)/.exec(url.pathname);
  return m ? m[2] : null;
}

let apiPromise: Promise<YouTubeApi> | null = null;

/**
 * Load YouTube's iframe API once per page. The script calls a single global
 * callback when it is ready, so every player has to wait on the same promise
 * rather than each loading its own copy.
 */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube API loaded without a Player'));
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Could not load the YouTube API'));
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Where a follower's playhead should be now, given when the instructor sampled
 * theirs. Without the elapsed-time term every follower would land where the
 * instructor was when the message was sent, and sit permanently behind.
 */
export function expectedTime(state: VideoState, now = Date.now()): number {
  if (!state.playing) return state.time;
  return state.time + Math.max(0, (now - state.at) / 1000);
}
