'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TajweedAnnotation,
  TajweedAnnotationStyle,
  TajweedRef,
  TajweedRule,
  TajweedTemporaryAnnotation,
} from '@/lib/realtime-contract';
import {
  createTajweed,
  deleteTajweed,
  indexByAyah,
  listTajweed,
  newAnnotationId,
  TAJWEED_SUGGESTED_COLORS,
  TajweedApiError,
  tajweedHistory,
  updateTajweed,
  type AnyTajweedMark,
  type TajweedCreateInput,
} from '@/lib/tajweed';

/** What tapping a rule does: show it to the class now, save it to the lesson,
 *  or record it against the student who is reciting. */
export type TajweedMode = 'LIVE' | 'LESSON' | 'CORRECTION';

export interface TajweedPrefs {
  style: TajweedAnnotationStyle;
  colors: Record<TajweedRule, string>;
  /** Seconds a live annotation stays up; 0 keeps it until cleared. */
  liveSeconds: number;
}

/** A saved annotation, flagged while this client still waits on the server. */
export type SavedMark = TajweedAnnotation & { pending?: boolean };

export type TajweedApi = ReturnType<typeof useTajweed>;

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** The socket ref when there is no room — preparing a lesson. Always the same
 *  object, so callbacks that read it keep a stable identity. */
const NO_SOCKET: RefObject<RoomSocket | null> = { current: null };

const DEFAULT_PREFS: TajweedPrefs = {
  style: 'HIGHLIGHT',
  colors: TAJWEED_SUGGESTED_COLORS,
  liveSeconds: 0,
};

const prefsKey = (courseId: string) => `livetich:tajweed-prefs:${courseId}`;
const outboxKey = (scope: string) => `livetich:tajweed-outbox:${scope}`;

function loadPrefs(courseId: string): TajweedPrefs {
  try {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    const raw = window.localStorage.getItem(prefsKey(courseId));
    if (!raw) return DEFAULT_PREFS;
    const saved = JSON.parse(raw) as Partial<TajweedPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...saved,
      colors: { ...DEFAULT_PREFS.colors, ...saved.colors },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(courseId: string, prefs: TajweedPrefs) {
  try {
    window.localStorage.setItem(prefsKey(courseId), JSON.stringify(prefs));
  } catch {
    // Private browsing: the choice lasts this visit only.
  }
}

/**
 * Creates still waiting to reach the server, kept on this device.
 *
 * A teacher's saved annotation has to survive the connection dropping in the
 * middle of class. Every create carries its own id, so replaying the queue
 * after reconnecting can never make a second copy of one that did land.
 */
function readOutbox(scope: string): TajweedCreateInput[] {
  try {
    return JSON.parse(
      window.localStorage.getItem(outboxKey(scope)) ?? '[]',
    ) as TajweedCreateInput[];
  } catch {
    return [];
  }
}

function writeOutbox(scope: string, items: TajweedCreateInput[]) {
  try {
    if (items.length) {
      window.localStorage.setItem(outboxKey(scope), JSON.stringify(items));
    } else {
      window.localStorage.removeItem(outboxKey(scope));
    }
  } catch {
    // Nowhere to keep it; the in-memory copy still shows as saving.
  }
}

export function refOf(mark: TajweedRef): TajweedRef {
  return {
    surahNumber: mark.surahNumber,
    ayahNumber: mark.ayahNumber,
    selection: mark.selection,
    wordStart: mark.wordStart,
    wordEnd: mark.wordEnd,
    letterStart: mark.letterStart,
    letterEnd: mark.letterEnd,
  };
}

function optimistic(courseId: string, input: TajweedCreateInput): SavedMark {
  const now = new Date().toISOString();
  return {
    ...refOf(input),
    id: input.id,
    courseId,
    sectionId: input.sectionId ?? null,
    sessionId: input.sessionId ?? null,
    mode: input.mode,
    studentId: input.studentId ?? null,
    hifzEntryId: input.hifzEntryId ?? null,
    rule: input.rule ?? null,
    customLabel: input.customLabel ?? null,
    style: input.style ?? 'HIGHLIGHT',
    color: input.color ?? null,
    note: input.note ?? null,
    outcome: input.outcome ?? null,
    version: 0,
    createdById: '',
    updatedById: '',
    createdAt: now,
    updatedAt: now,
    pending: true,
  };
}

/** Put a saved annotation in a list. An older version never replaces a newer
 *  one — the socket and a reload can deliver them in either order. */
function upsert(list: SavedMark[], next: SavedMark): SavedMark[] {
  const i = list.findIndex((m) => m.id === next.id);
  if (i < 0) return [...list, next];
  if (!list[i].pending && list[i].version > next.version) return list;
  const out = list.slice();
  out[i] = next;
  return out;
}

/** A fresh load, keeping what is newer here and what has not reached the
 *  server yet. */
function mergeSaved(prev: SavedMark[], fresh: TajweedAnnotation[]): SavedMark[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  const freshIds = new Set(fresh.map((f) => f.id));
  const out: SavedMark[] = fresh.map((f) => {
    const had = byId.get(f.id);
    return had && !had.pending && had.version > f.version ? had : f;
  });
  for (const m of prev) if (m.pending && !freshIds.has(m.id)) out.push(m);
  return out;
}

/**
 * Tajweed annotations for one live session — or, with no session, for one
 * lesson being prepared ahead of class.
 *
 * Saved annotations come over HTTP and are kept current by room events; live
 * ones arrive only over the socket and are replaced wholesale on every event.
 * Without a socket there is no room to show live marks or hear a student in,
 * so only lesson marks can be made. Hiding and filtering never delete
 * anything — they only change what is drawn.
 */
export function useTajweed({
  courseId,
  sessionId,
  sectionId,
  canEdit,
  enabled,
  socketRef = NO_SOCKET,
  initialMode = 'LIVE',
}: {
  courseId: string;
  /** The live session. Absent when preparing a lesson outside class. */
  sessionId?: string;
  /** The lesson being prepared, when there is no session. */
  sectionId?: string;
  canEdit: boolean;
  /** Islamic Education pack on. Off = the hook does nothing. */
  enabled: boolean;
  socketRef?: RefObject<RoomSocket | null>;
  initialMode?: TajweedMode;
}) {
  // Where queued creates are kept: per session, or per lesson being prepared.
  const scope = sessionId ?? `lesson:${sectionId ?? 'course'}`;

  const [lesson, setLesson] = useState<SavedMark[]>([]);
  const [corrections, setCorrections] = useState<SavedMark[]>([]);
  const [live, setLive] = useState<TajweedTemporaryAnnotation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenRules, setHiddenRules] = useState<ReadonlySet<TajweedRule>>(
    () => new Set(),
  );
  const [hideAll, setHideAll] = useState(false);
  const [prefs, setPrefs] = useState<TajweedPrefs>(() => loadPrefs(courseId));
  const [mode, setMode] = useState<TajweedMode>(initialMode);
  const [correctionStudent, setCorrectionStudent] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const setterFor = (m: { mode: TajweedAnnotation['mode'] }) =>
    m.mode === 'LESSON' ? setLesson : setCorrections;

  // ---- incoming ------------------------------------------------------------

  const receiveSaved = useCallback((annotation: TajweedAnnotation) => {
    setterFor(annotation)((prev) => upsert(prev, annotation));
  }, []);

  const receiveDeleted = useCallback((id: string) => {
    setLesson((prev) => prev.filter((m) => m.id !== id));
    setCorrections((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const receiveLive = useCallback((annotations: TajweedTemporaryAnnotation[]) => {
    setLive(annotations);
  }, []);

  const applyLoaded = useCallback(
    (data: { lesson: TajweedAnnotation[]; corrections: TajweedAnnotation[] }) => {
      setLesson((prev) => mergeSaved(prev, data.lesson));
      setCorrections((prev) => mergeSaved(prev, data.corrections));
      setLoadError(null);
    },
    [],
  );

  const loadFailed = useCallback((e: unknown) => {
    setLoadError(e instanceof Error ? e.message : 'Could not load the Tajweed annotations');
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      applyLoaded(await listTajweed(courseId, { sessionId, sectionId }));
    } catch (e) {
      loadFailed(e);
    }
  }, [courseId, sessionId, sectionId, enabled, applyLoaded, loadFailed]);

  // ---- saving --------------------------------------------------------------

  const send = useCallback(
    async (input: TajweedCreateInput): Promise<boolean> => {
      try {
        const saved = await createTajweed(courseId, input);
        writeOutbox(scope, readOutbox(scope).filter((i) => i.id !== input.id));
        receiveSaved(saved);
        return true;
      } catch (e) {
        if (e instanceof TajweedApiError && !e.retryable) {
          // The server said no — retrying will not change its mind.
          writeOutbox(scope, readOutbox(scope).filter((i) => i.id !== input.id));
          setterFor(input)((prev) => prev.filter((m) => m.id !== input.id));
          setError(e.message);
          return false;
        }
        setError('Kept on this device — it will be saved when the connection is back.');
        return false;
      }
    },
    [courseId, scope, receiveSaved],
  );

  /** Send anything still queued. Stops at the first failure, so a dead
   *  connection is tried once rather than once per queued annotation. */
  const flushOutbox = useCallback(async () => {
    if (!enabled || !canEdit) return;
    for (const item of readOutbox(scope)) {
      setterFor(item)((prev) =>
        prev.some((m) => m.id === item.id) ? prev : [...prev, optimistic(courseId, item)],
      );
      if (!(await send(item))) break;
    }
  }, [enabled, canEdit, scope, courseId, send]);

  const resync = useCallback(() => {
    void refresh().then(flushOutbox);
  }, [refresh, flushOutbox]);

  // Load the annotations, then send anything queued before a reload. State is
  // only ever set once the request settles, and not at all if the session or
  // lesson changed in the meantime.
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    listTajweed(courseId, { sessionId, sectionId })
      .then((data) => {
        if (current) applyLoaded(data);
      })
      .catch((e: unknown) => {
        if (current) loadFailed(e);
      })
      .finally(() => {
        if (current) void flushOutbox();
      });
    return () => {
      current = false;
    };
  }, [enabled, courseId, sessionId, sectionId, applyLoaded, loadFailed, flushOutbox]);

  useEffect(() => {
    if (!enabled || !canEdit) return;
    const onOnline = () => void flushOutbox();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, canEdit, flushOutbox]);

  const create = useCallback(
    (input: Omit<TajweedCreateInput, 'id' | 'sessionId' | 'sectionId'>) => {
      const full: TajweedCreateInput = {
        ...input,
        id: newAnnotationId(),
        ...(sessionId ? { sessionId } : {}),
        ...(sectionId ? { sectionId } : {}),
      };
      setterFor(full)((prev) => [...prev, optimistic(courseId, full)]);
      writeOutbox(scope, [...readOutbox(scope), full]);
      void send(full);
    },
    [courseId, sessionId, sectionId, scope, send],
  );

  const update = useCallback(
    async (
      mark: SavedMark,
      patch: { note?: string | null; rule?: TajweedRule; color?: string | null },
    ) => {
      if (mark.pending) {
        setError('Still saving this one — try again in a moment.');
        return;
      }
      try {
        const saved = await updateTajweed(courseId, mark.id, {
          ...patch,
          version: mark.version,
          ...(sessionId ? { sessionId } : {}),
        });
        receiveSaved(saved);
        setError(null);
      } catch (e) {
        if (e instanceof TajweedApiError && e.status === 409) {
          if (e.current) receiveSaved(e.current);
          else void refresh();
          setError('This was changed somewhere else first — showing that version.');
        } else {
          setError(e instanceof Error ? e.message : 'Could not save the change');
        }
      }
    },
    [courseId, sessionId, receiveSaved, refresh],
  );

  const remove = useCallback(
    async (mark: SavedMark) => {
      if (mark.pending) {
        setError('Still saving this one — try again in a moment.');
        return;
      }
      setterFor(mark)((prev) => prev.filter((m) => m.id !== mark.id));
      try {
        await deleteTajweed(courseId, mark.id, sessionId);
        setError(null);
      } catch (e) {
        if (e instanceof TajweedApiError && e.status === 404) return; // already gone
        setterFor(mark)((prev) => upsert(prev, mark));
        setError(e instanceof Error ? e.message : 'Could not delete it');
      }
    },
    [courseId, sessionId],
  );

  const history = useCallback(
    (id: string) => tajweedHistory(courseId, id),
    [courseId],
  );

  // ---- live ----------------------------------------------------------------

  const showLive = useCallback(
    (
      ref: TajweedRef,
      rule: TajweedRule,
      opts: { note?: string; customLabel?: string },
    ) => {
      if (!sessionId) return;
      socketRef.current?.emit('tajweed:temporary:set', {
        sessionId,
        annotation: {
          ...refOf(ref),
          id: newAnnotationId(),
          rule,
          customLabel: opts.customLabel ?? null,
          style: prefs.style,
          color: prefs.colors[rule],
          note: opts.note || null,
          ttlSec: prefs.liveSeconds,
        },
      });
    },
    [socketRef, sessionId, prefs],
  );

  const clearLive = useCallback(
    (id?: string) => {
      if (!sessionId) return;
      socketRef.current?.emit('tajweed:temporary:clear', {
        sessionId,
        ...(id ? { id } : {}),
      });
    },
    [socketRef, sessionId],
  );

  /** Keep a live annotation: save it to the lesson, then take down the live copy. */
  const liveToLesson = useCallback(
    (a: TajweedTemporaryAnnotation) => {
      create({
        ...refOf(a),
        mode: 'LESSON',
        rule: a.rule,
        customLabel: a.customLabel ?? undefined,
        style: a.style,
        color: a.color ?? undefined,
        note: a.note ?? undefined,
      });
      clearLive(a.id);
    },
    [create, clearLive],
  );

  // Live annotations with a lifetime disappear on this clock too, so nobody
  // waits for the next room event to see one go.
  const liveNow = useMemo(
    () => live.filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now),
    [live, now],
  );
  const nextExpiry = useMemo(() => {
    let min: number | null = null;
    for (const a of liveNow) {
      if (!a.expiresAt) continue;
      const t = Date.parse(a.expiresAt);
      if (min === null || t < min) min = t;
    }
    return min;
  }, [liveNow]);
  useEffect(() => {
    if (nextExpiry === null) return;
    const t = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextExpiry - Date.now()) + 50,
    );
    return () => window.clearTimeout(t);
  }, [nextExpiry]);

  // ---- what is drawn ----------------------------------------------------------

  const visible = useMemo<AnyTajweedMark[]>(() => {
    if (hideAll) return [];
    const shown = (m: { rule: TajweedRule | null }) => !m.rule || !hiddenRules.has(m.rule);
    // A teacher sees corrections only while recording them for one student, so
    // the lesson text is not buried under the whole class's mistakes. A student
    // is sent only their own, and sees them.
    const theirCorrections = canEdit
      ? mode === 'CORRECTION' && correctionStudent
        ? corrections.filter((c) => c.studentId === correctionStudent)
        : []
      : corrections;
    return [
      ...lesson.filter(shown),
      ...theirCorrections.filter(shown),
      ...liveNow.filter(shown).map((a) => ({ ...a, live: true })),
    ];
  }, [hideAll, hiddenRules, canEdit, mode, correctionStudent, corrections, lesson, liveNow]);

  const index = useMemo(() => indexByAyah(visible), [visible]);

  /** One entry per rule on the page, in the colour it is actually drawn in. */
  const legend = useMemo(() => {
    const seen = new Map<TajweedRule, string>();
    for (const m of visible) {
      if (m.rule && !seen.has(m.rule)) {
        seen.set(m.rule, m.color ?? TAJWEED_SUGGESTED_COLORS[m.rule]);
      }
    }
    return [...seen].map(([rule, color]) => ({ rule, color }));
  }, [visible]);

  const toggleRule = useCallback((rule: TajweedRule) => {
    setHiddenRules((prev) => {
      const next = new Set(prev);
      if (next.has(rule)) next.delete(rule);
      else next.add(rule);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHideAll(false);
    setHiddenRules(new Set());
  }, []);

  const updatePrefs = useCallback(
    (
      patch: Partial<Omit<TajweedPrefs, 'colors'>> & {
        colors?: Partial<Record<TajweedRule, string>>;
      },
    ) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch, colors: { ...prev.colors, ...patch.colors } };
        savePrefs(courseId, next);
        return next;
      });
    },
    [courseId],
  );

  return {
    canEdit,
    lesson,
    corrections,
    live: liveNow,
    index,
    legend,
    loadError,
    error,
    clearError: () => setError(null),
    hiddenRules,
    toggleRule,
    hideAll,
    setHideAll,
    showAll,
    prefs,
    updatePrefs,
    mode,
    setMode,
    correctionStudent,
    setCorrectionStudent,
    create,
    update,
    remove,
    history,
    showLive,
    clearLive,
    liveToLesson,
    receiveSaved,
    receiveDeleted,
    receiveLive,
    resync,
  };
}
