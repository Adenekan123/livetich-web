/**
 * What this browser remembers about how you join a class.
 *
 * The whole point of the prejoin screen is that it is only interesting once.
 * The first time, a student picks the headset they actually want and finds out
 * their camera works; every class after that the screen should already be
 * right and the only thing left to do is press Join. That is only true if the
 * choice survives the session, so it lives here rather than in React state.
 *
 * Per browser, never on the server: a device id means nothing on another
 * machine, and the same person on a phone and a laptop wants two different
 * answers. Nothing here is authoritative — a remembered device that has since
 * been unplugged is a hint the prejoin screen falls back from, not a promise.
 */

const KEY = 'livetich.media.v1';

export interface MediaPrefs {
  /** `null` means "whatever the browser considers default". */
  cameraDeviceId: string | null;
  micDeviceId: string | null;
  speakerDeviceId: string | null;
  /** How you last entered a room — not whether the device exists. */
  cameraOn: boolean;
  micOn: boolean;
}

export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  cameraDeviceId: null,
  micDeviceId: null,
  speakerDeviceId: null,
  cameraOn: true,
  // Off by default. A class is one instructor and many students, and a room
  // where everyone arrives unmuted is the failure mode everybody knows.
  micOn: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asDeviceId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** Never throws, and never returns a partial object. */
export function readMediaPrefs(): MediaPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_MEDIA_PREFS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_MEDIA_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_MEDIA_PREFS };
    return {
      cameraDeviceId: asDeviceId(parsed.cameraDeviceId),
      micDeviceId: asDeviceId(parsed.micDeviceId),
      speakerDeviceId: asDeviceId(parsed.speakerDeviceId),
      cameraOn:
        typeof parsed.cameraOn === 'boolean'
          ? parsed.cameraOn
          : DEFAULT_MEDIA_PREFS.cameraOn,
      micOn:
        typeof parsed.micOn === 'boolean'
          ? parsed.micOn
          : DEFAULT_MEDIA_PREFS.micOn,
    };
  } catch {
    // Private browsing, blocked storage, or something else wrote over the key.
    return { ...DEFAULT_MEDIA_PREFS };
  }
}

export function writeMediaPrefs(patch: Partial<MediaPrefs>): MediaPrefs {
  const next = { ...readMediaPrefs(), ...patch };
  if (typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Remembering is a convenience; failing to remember is not an error worth
    // showing anyone.
  }
  return next;
}
