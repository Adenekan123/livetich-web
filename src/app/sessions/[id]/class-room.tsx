'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { endSession } from '@/app/actions/courses';
import { API_URL } from '@/lib/api';
import { clearRealtimeToken, getRealtimeToken } from '@/lib/client-token';
import { avatarColor, btn, cn, initials } from '@/lib/ui';
import type {
  BuzzerState,
  ChatMessage,
  ClientToServerEvents,
  CodingPointEntry,
  LeaderboardEntry,
  RoomScheme,
  RoomUser,
  ServerToClientEvents,
  StageView,
} from '@/lib/realtime-contract';
import dynamic from 'next/dynamic';
import {
  PiBookOpenText,
  PiChalkboardTeacher,
  PiCode,
  PiChatCircle,
  PiClipboardText,
  PiDotsThreeOutline,
  PiHandPalm,
  PiHandWaving,
  PiLightning,
  PiListChecks,
  PiLockSimple,
  PiLockSimpleOpen,
  PiMicrophone,
  PiMicrophoneSlash,
  PiMicrophoneStage,
  PiPalette,
  PiPhoneX,
  PiScreencast,
  PiShuffle,
  PiSignOut,
  PiTrophy,
  PiUsers,
  PiVideoCamera,
  PiVideoCameraSlash,
  PiX,
} from 'react-icons/pi';
import { VideoStage, type VideoControls } from './video-stage';
import {
  BuzzerQuestionModal,
  type NewBuzzerQuestion,
} from './buzzer-question-modal';
import { BuzzerPickerModal } from './buzzer-picker-modal';
import {
  LiveHifzPanel,
  submitHifzDraft,
  type HifzDraft,
} from './live-hifz-panel';
import { LiveGradingPanel } from './live-grading-panel';
import { LiveCurriculumPanel } from './live-curriculum-panel';
import {
  LiveCodingPanel,
  type LiveCodingReview,
  type LiveCodingTask,
} from './live-coding-panel';
import { QuranReader } from './quran-reader';
import { useTajweed } from './use-tajweed';
import { useClassroomChat } from './use-classroom-chat';
import { RecordButton } from './record-button';
import { playRecordingTone } from './recording-sound';
import {
  playClassEndTone,
  playClassStartTone,
  playJoinTone,
  primeTones,
  startQuestionTone,
  stopAllToneLoops,
  stopQuestionTone,
} from './tone-player';

// Excalidraw touches browser-only APIs, so it must not render on the server.
const BoardExcalidraw = dynamic(
  () => import('./board-excalidraw').then((m) => m.BoardExcalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
        Loading board…
      </div>
    ),
  },
);

// CodeMirror is browser-only too — same client-only dynamic import as the board.
const CodeBoard = dynamic(
  () => import('./code-board').then((m) => m.CodeBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl bg-[#282c34] text-sm text-neutral-500">
        Loading editor…
      </div>
    ),
  },
);

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface BuzzerQuestion {
  id: string;
  body: string;
  timeLimitSec: number;
}

/** Short WebAudio cues for the buzzer — synthesized on the fly, no assets.
 *  'open' = an attention buzz when a round appears; 'timeout' = a descending
 *  "dying" tone when it auto-closes on time-up; 'win' = a quick rising chime
 *  when someone answers first. Best-effort: never let a cue break the room. */
function playBuzzerCue(
  ctxRef: { current: AudioContext | null },
  kind: 'open' | 'timeout' | 'win',
) {
  try {
    type ACtor = typeof AudioContext;
    const Ctor: ACtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = ctxRef.current ?? (ctxRef.current = new Ctor());
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;

    const beep = (
      at: number,
      dur: number,
      from: number,
      to: number,
      type: OscillatorType,
      peak = 0.18,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0 + at);
      if (to !== from) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, to),
          t0 + at + dur,
        );
      }
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.03);
    };

    if (kind === 'open') {
      beep(0, 0.12, 520, 520, 'square');
      beep(0.14, 0.18, 780, 780, 'square');
    } else if (kind === 'win') {
      beep(0, 0.1, 660, 660, 'triangle', 0.16);
      beep(0.11, 0.2, 990, 990, 'triangle', 0.16);
    } else {
      beep(0, 0.6, 440, 90, 'sawtooth', 0.16);
    }
  } catch {
    /* audio unavailable — ignore */
  }
}

interface Wave {
  id: string;
  name: string;
}

/** A student must have waited this long for the instructor before their arrival
 *  counts as the class starting. Shorter gaps are a join racing the first
 *  presence list, or a reconnect — neither is a start. */
const START_TONE_MIN_WAIT_MS = 3000;

const MEDALS = ['🥇', '🥈', '🥉'];

/** The shared surfaces the instructor can put the class on. Which ones actually
 *  appear depends on the org's add-on packs (see `views` in the component). */
const VIEW_META = {
  video: { label: 'Room', Icon: PiVideoCamera },
  board: { label: 'Chalkboard', Icon: PiChalkboardTeacher },
  quran: { label: 'Qur’an', Icon: PiBookOpenText },
  code: { label: 'Code', Icon: PiCode },
} as const;
const VIEWS = ['video', 'board', 'quran', 'code'] as const;

/** Selectable room colour schemes. `swatch` is the accent shown in the picker;
 *  `bg` previews the room background. Keep in sync with globals.css + the
 *  RoomScheme contract. 'teal' is the classic default. */
const SCHEME_META: Record<
  RoomScheme,
  { label: string; swatch: string; bg: string }
> = {
  teal: { label: 'Teal', swatch: '#0d9488', bg: '#0a0a0a' },
  forest: { label: 'Forest', swatch: '#10b981', bg: '#071108' },
  indigo: { label: 'Indigo', swatch: '#6366f1', bg: '#0a091d' },
  plum: { label: 'Plum', swatch: '#f43f5e', bg: '#17070f' },
};
const SCHEMES = ['teal', 'forest', 'indigo', 'plum'] as const;

/** A pill-shaped control button for the dark bottom bar. */
function ctrl(
  variant: 'default' | 'on' | 'danger' = 'default',
  extra = '',
): string {
  return cn(
    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
    variant === 'on' && 'bg-signal-600 text-white hover:bg-signal-500',
    variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
    variant === 'default' && 'bg-white/10 text-neutral-100 hover:bg-white/20',
    extra,
  );
}

export function ClassRoom({
  sessionId,
  courseId,
  courseTitle,
  me,
  teaching = false,
  islamicEducation = false,
  codeInstruction = false,
  mathsSciences = false,
  initialView,
  dataSaverDefault,
}: {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  me: RoomUser;
  /** This user is an org admin entering in teach-mode: treat them as the
   *  instructor (host UI + controls) rather than a hidden observer. */
  teaching?: boolean;
  /** Islamic Education pack on for this org — unlocks the mushaf surface and
   *  the Hifz panel. Off = a general classroom (video, chalkboard). */
  islamicEducation?: boolean;
  /** Code Instruction pack on for this org — unlocks the shared code editor. */
  codeInstruction?: boolean;
  /** Maths & Sciences pack on for this org — unlocks the chalkboard's formula
   *  tool. Off = a chalkboard with pen, shapes, text and imports, which is
   *  what an instructor who never writes an equation actually wants. */
  mathsSciences?: boolean;
  /** Test Prep pack on. The classroom reads nothing from it since the board
   *  templates went; still accepted so callers need not change. */
  testPrep?: boolean;
  /** The surface the class is already on, when the caller knows it up front. */
  initialView?: StageView;
  /** Override the automatic data-saver decision. The recorder pins this off:
   *  its connection hints are whatever LiveKit's container reports, and a
   *  recording that quietly drops every camera to save someone's bandwidth is
   *  not a saving, it is a broken recording. */
  dataSaverDefault?: boolean;
}) {
  const router = useRouter();
  const [ending, startEnding] = useTransition();
  const socketRef = useRef<RoomSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [hands, setHands] = useState<RoomUser[]>([]);
  // Student ids the instructor has granted the mic. Students are muted by
  // default and can only unmute once they appear here (or are picked to speak).
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  // Live coding task in the room: the announced task, the shared points board,
  // and (staff only) the per-submission review cards.
  const [codingTask, setCodingTask] = useState<LiveCodingTask | null>(null);
  const [codingPoints, setCodingPoints] = useState<CodingPointEntry[]>([]);
  const [codingReviews, setCodingReviews] = useState<LiveCodingReview[]>([]);
  const [buzzer, setBuzzer] = useState<BuzzerState | null>(null);
  const [picked, setPicked] = useState<RoomUser | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  // The option index this student tapped in the current buzzer round — gives
  // immediate visual feedback (there's no hover on touch) and stays highlighted
  // once locked in. Reset when a new round opens.
  const [pickedAnswer, setPickedAnswer] = useState<number | null>(null);
  // Ticking clock (ms) that drives the buzzer countdown while a round is open.
  const [now, setNow] = useState(() => Date.now());
  // Local deadline (ms on THIS client's clock) for the open buzzer round —
  // anchored to when we received QUESTION_OPEN, not the server's `openedAt`.
  // Counting down against the server's absolute timestamp made rounds open
  // already at 0s (and un-answerable) whenever the API host's clock ran behind
  // the viewer's; a local deadline is immune to that skew.
  const [buzzerDeadline, setBuzzerDeadline] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Counter bumped on every `submission:new`; drives the grading panel reload.
  const [submissionPing, setSubmissionPing] = useState(0);
  // Defaults to the room, but a caller that already knows better says so. The
  // recorder does: it is handed the class's current surface with its context,
  // so a recording never opens on the wrong one while waiting for the socket to
  // replay the real value.
  const [view, setView] = useState<StageView>(initialView ?? 'video');
  // Instructor-driven room colour scheme, synced to everyone via the gateway.
  const [scheme, setScheme] = useState<RoomScheme>('teal');
  const [schemePicker, setSchemePicker] = useState(false);
  const [quranPos, setQuranPos] = useState<{ surah: number; ayah: number }>({
    surah: 1,
    ayah: 1,
  });
  // An in-progress recitation the instructor is logging against the mushaf. It
  // lives here (not in the Hifz panel) so it survives panel switches and can be
  // auto-saved when the instructor ends the class.
  const [hifzDraft, setHifzDraft] = useState<HifzDraft | null>(null);
  // Default data-saver on when the browser/OS signals a metered or slow network.
  const [dataSaver, setDataSaver] = useState(() => {
    if (dataSaverDefault !== undefined) return dataSaverDefault;
    if (typeof navigator === 'undefined') return false;
    const c = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    return (
      c?.saveData === true ||
      c?.effectiveType === '2g' ||
      c?.effectiveType === 'slow-2g'
    );
  });
  const [questions, setQuestions] = useState<BuzzerQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  // Inline "create a buzzer question" modal. `startBuzzerOnCreate` launches the
  // round as soon as the new question saves (the empty-state flow).
  const [buzzerForm, setBuzzerForm] = useState(false);
  const [startBuzzerOnCreate, setStartBuzzerOnCreate] = useState(false);
  // Picker modal: on "Start buzzer" the instructor chooses which authored
  // question to broadcast (rather than it always firing the first one).
  const [buzzerPicker, setBuzzerPicker] = useState(false);
  const [panel, setPanel] = useState<
    'chat' | 'people' | 'points' | 'hifz' | 'work' | 'coding' | 'curriculum' | null
  >('chat');
  // Live mirror of `panel` for the socket handler (registered once, so it can't
  // close over a stale value) — used to decide whether an incoming chat message
  // counts as unread.
  const panelRef = useRef(panel);
  const [videoControls, setVideoControls] = useState<VideoControls | null>(null);
  // Mobile bottom-bar overflow: secondary controls collapse behind a "More"
  // toggle so the bar stays compact on phones (no effect at md+).
  const [moreOpen, setMoreOpen] = useState(false);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const handsRef = useRef<RoomUser[]>([]);
  const handsSeededRef = useRef(false);
  // Buzzer sound + auto-close plumbing.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevBuzzerPhaseRef = useRef<BuzzerState['phase'] | null>(null);
  const buzzerDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cue = (kind: 'open' | 'timeout' | 'win') =>
    playBuzzerCue(audioCtxRef, kind);
  // The question tone runs for as long as the question does, so every path out
  // of an open round has to switch it off — answered, timed out, dismissed,
  // or the room closing under it. Centralised here so none of them can forget.
  const stopBuzzerTone = () => stopQuestionTone();
  // Who was in the room at the last presence update, so the instructor's join
  // sound fires for arrivals only. Null until the first list, which is who was
  // already here rather than anyone arriving.
  const presentRef = useRef<Set<string> | null>(null);
  // When the join sound last played: a burst of arrivals gets one sound.
  const joinToneAtRef = useRef(0);

  // A teach-mode admin acts as the instructor (host UI, publishes, controls).
  const isInstructor = me.role === 'INSTRUCTOR' || teaching;

  const {
    messages,
    unreadChat,
    locked,
    recording,
    uploadingVoice,
    chatEndRef,
    send,
    startRecording,
    stopRecording,
    toggleLock,
    clearUnread,
    handleHistory,
    handleNewMessage,
    handleLockUpdate,
  } = useClassroomChat({
    sessionId,
    myUserId: me.userId,
    isInstructor,
    socketRef,
    isChatOpen: panel === 'chat',
    onNotice: setNotice,
  });
  // Tajweed annotations on the shared mushaf. Always created (it is a hook),
  // inert unless the Islamic Education pack is on.
  const tajweed = useTajweed({
    courseId,
    sessionId,
    canEdit: isInstructor,
    enabled: islamicEducation,
    socketRef,
  });
  // Socket handlers are bound once per connection; they reach the latest hook
  // through this ref rather than re-binding every time an annotation changes.
  const tajweedRef = useRef(tajweed);
  useEffect(() => {
    tajweedRef.current = tajweed;
  });
  // Admins otherwise shadow-join: hidden from everyone, read-only. They watch
  // and listen but never publish, raise a hand, or post — presence stays unseen.
  const isShadow = me.role === 'ORG_ADMIN' && !teaching;

  // Warm the heavy Excalidraw board chunk shortly after mount so opening the
  // chalkboard is near-instant instead of a multi-second first-load download.
  // Delayed so the download doesn't compete with the join's connection requests.
  useEffect(() => {
    const t = setTimeout(() => void import('./board-excalidraw'), 1500);
    return () => clearTimeout(t);
  }, []);
  // Pack-gated surfaces: the mushaf needs Islamic Education, the code editor
  // needs Code Instruction. Everything else (video, chalkboard) is core.
  const views = VIEWS.filter(
    (v) =>
      (v !== 'quran' || islamicEducation) && (v !== 'code' || codeInstruction),
  );
  const myHandRaised = hands.some((h) => h.userId === me.userId);
  // Seconds left on the open buzzer round (null when none is running). Measured
  // against the local deadline set when this client saw the round open, so a
  // server/client clock disagreement can't zero it out.
  const buzzerRemaining =
    buzzer?.phase === 'QUESTION_OPEN' && buzzerDeadline !== null
      ? Math.max(0, Math.ceil((buzzerDeadline - now) / 1000))
      : null;
  // Instructors always have the mic; students only once granted (or picked).
  const canSpeak = isInstructor || speakers.includes(me.userId);
  // Students can join before the instructor arrives; until a host is present in
  // the room, they wait rather than staring at an empty call.
  const instructorPresent = users.some((u) => u.role === 'INSTRUCTOR');
  const waitingForInstructor = !isInstructor && connected && !instructorPresent;

  // The class starts when the instructor arrives, and that is when the start
  // chime plays. A student hears it only if they were actually waiting — not
  // on joining a class already under way (the first presence list briefly has
  // no one in it), and not when a dropped connection hands the instructor
  // straight back. The instructor hears it once, on going live.
  const waitingSinceRef = useRef<number | null>(null);
  const startToneDoneRef = useRef(false);
  useEffect(() => {
    if (isInstructor) {
      if (connected && !startToneDoneRef.current) {
        startToneDoneRef.current = true;
        playClassStartTone();
      }
      return;
    }
    if (waitingForInstructor) {
      waitingSinceRef.current ??= Date.now();
      return;
    }
    const since = waitingSinceRef.current;
    waitingSinceRef.current = null;
    if (
      connected &&
      instructorPresent &&
      since !== null &&
      Date.now() - since > START_TONE_MIN_WAIT_MS
    ) {
      playClassStartTone();
    }
  }, [isInstructor, connected, instructorPresent, waitingForInstructor]);

  // Keyboard: Escape dismisses the leave/end-class confirmation, matching the
  // standard modal contract (the overlay also closes on backdrop click).
  useEffect(() => {
    if (!confirmLeave) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmLeave(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmLeave]);

  useEffect(() => {
    const socket: RoomSocket = io(API_URL, {
      // Async auth: the httpOnly cookie is fetched from a same-origin route.
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket'],
    });
    socketRef.current = socket;
    // A stale realtime token makes the gateway reject auth and disconnect us.
    // Socket.IO does NOT auto-reconnect after a server-initiated disconnect, so
    // we re-open the socket ourselves after dropping the bad token — capped, so
    // a genuinely bad session (e.g. logged out) surfaces the error instead of
    // looping. Reset once a connect succeeds.
    let authRetries = 0;
    const MAX_AUTH_RETRIES = 2;
    // The first connect loads Tajweed annotations on mount already; every later
    // one is a reconnect, which may have missed events while offline.
    let tajweedConnectedBefore = false;

    const pushWave = (name: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setWaves((w) => [...w, { id, name }]);
      setTimeout(() => setWaves((w) => w.filter((x) => x.id !== id)), 4500);
    };

    socket.on('connect', () => {
      authRetries = 0;
      setConnected(true);
      if (tajweedConnectedBefore) tajweedRef.current.resync();
      tajweedConnectedBefore = true;
      socket.emit('room:join', {
        sessionId,
        ...(teaching ? { as: 'teach' as const } : {}),
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:presence', (p) => {
      setUsers(p.users);
      const before = presentRef.current;
      presentRef.current = new Set(p.users.map((u) => u.userId));
      // Only the instructor hears arrivals — a class of thirty arriving should
      // not be thirty sounds for everyone.
      if (!before || !isInstructor) return;
      const arrived = p.users.some(
        (u) =>
          u.role === 'STUDENT' && u.userId !== me.userId && !before.has(u.userId),
      );
      if (arrived && Date.now() - joinToneAtRef.current > 2000) {
        joinToneAtRef.current = Date.now();
        playJoinTone();
      }
    });
    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleNewMessage);
    socket.on('chat:locked', handleLockUpdate);
    socket.on('recording:status', (p) => {
      // Notify students by tone whenever recording begins or ends
      if (!isInstructor) {
        playRecordingTone(p.recording ? 'start' : 'stop');
      }
    });
    socket.on('view:changed', (p) => setView(p.view));
    socket.on('theme:changed', (p) => setScheme(p.scheme));
    socket.on('quran:position', (p) =>
      setQuranPos({ surah: p.surah, ayah: p.ayah }),
    );
    socket.on('tajweed:annotation:created', (p) =>
      tajweedRef.current.receiveSaved(p.annotation),
    );
    socket.on('tajweed:annotation:updated', (p) =>
      tajweedRef.current.receiveSaved(p.annotation),
    );
    socket.on('tajweed:annotation:deleted', (p) =>
      tajweedRef.current.receiveDeleted(p.id),
    );
    socket.on('tajweed:temporary', (p) =>
      tajweedRef.current.receiveLive(p.annotations),
    );
    // What the instructor has picked but not yet marked: the class sees the
    // same letters outlined while they decide which rule it is.
    socket.on('tajweed:pointing', (p) =>
      tajweedRef.current.receivePointing(p.parts),
    );
    // Staff-only: a student just submitted coursework. Nudge the grading panel
    // to reload and flag it to the instructor.
    socket.on('submission:new', (p) => {
      setSubmissionPing((n) => n + 1);
      setNotice(`${p.studentName} submitted ${p.assignmentTitle}`);
      setTimeout(() => setNotice(null), 4000);
    });
    socket.on('hands:update', (p) => {
      // Someone newly raising a hand gets a wave popup (skip our own). The first
      // snapshot on join just seeds state — don't animate already-raised hands.
      if (handsSeededRef.current) {
        const prevIds = new Set(handsRef.current.map((h) => h.userId));
        for (const u of p.raised) {
          if (!prevIds.has(u.userId) && u.userId !== me.userId) pushWave(u.name);
        }
      } else {
        handsSeededRef.current = true;
      }
      handsRef.current = p.raised;
      setHands(p.raised);
    });
    socket.on('leaderboard:update', (p) => setLeaderboard(p.entries));
    // Coding task in the room: announce, live points, and staff review cards.
    socket.on('coding:task', (p) => {
      setCodingTask({
        assignmentId: p.assignmentId,
        title: p.title,
        language: p.language,
        requirementCount: p.requirementCount,
      });
      setCodingReviews([]);
    });
    socket.on('coding:points', (p) => setCodingPoints(p.entries));
    socket.on('coding:submission', (p) => {
      // Keep only the latest event per submission (attempt-level state).
      setCodingReviews((prev) => [
        {
          submissionId: p.submissionId,
          assignmentId: p.assignmentId,
          studentId: p.studentId,
          studentName: p.studentName,
          attemptNumber: p.attemptNumber,
          status: p.status,
          provisionalScore: p.provisionalScore,
          finalScore: p.finalScore,
          aiConfidence: p.aiConfidence,
        },
        ...prev.filter((r) => r.submissionId !== p.submissionId),
      ]);
    });
    socket.on('mic:speakers', (p) => setSpeakers(p.userIds));
    socket.on('buzzer:state', (p) => {
      const prev = prevBuzzerPhaseRef.current;
      prevBuzzerPhaseRef.current = p.state.phase;
      setBuzzer(p.state);

      // Cancel any pending auto-close from an earlier terminal state.
      if (buzzerDismissRef.current) {
        clearTimeout(buzzerDismissRef.current);
        buzzerDismissRef.current = null;
      }

      if (p.state.phase === 'QUESTION_OPEN') {
        setAnswerResult(null);
        setPickedAnswer(null);
        setNow(Date.now()); // reset the countdown baseline
        // Anchor the deadline to this client's clock on the first frame of the
        // round (a reconnect that re-delivers the same open round keeps the
        // original deadline). Immune to server/client clock skew.
        if (prev !== 'QUESTION_OPEN') {
          setBuzzerDeadline(
            Date.now() + (p.state.question?.timeLimitSec ?? 0) * 1000,
          );
          // A round is a countdown, so the cue is a countdown too: a chime as
          // the question appears, then ticks timed to this round's limit that
          // quicken for the last five seconds, stopping the moment it is
          // resolved.
          startQuestionTone(p.state.question?.timeLimitSec ?? 0);
        }
      } else if (p.state.phase === 'WINNER' || p.state.phase === 'TIMEOUT') {
        setBuzzerDeadline(null);
        // Silence the question before the verdict, so the two never overlap.
        // 'timeout' is the descending "dying" tone that closes a round nobody
        // won — deliberately untouched.
        stopBuzzerTone();
        cue(p.state.phase === 'WINNER' ? 'win' : 'timeout');
        // Show the outcome briefly, then close the card for everyone.
        buzzerDismissRef.current = setTimeout(() => {
          setBuzzer(null);
          buzzerDismissRef.current = null;
        }, 3500);
      } else {
        // Any other phase — idle, or a round cleared out from under us.
        stopBuzzerTone();
      }
    });
    socket.on('quiz:answer-result', (p) => setAnswerResult(p.isCorrect));
    socket.on('student:picked', (p) => {
      setPicked(p.user);
      setTimeout(() => setPicked(null), 6000);
    });
    socket.on('error', (e) => {
      // An auth rejection ("Invalid token") means the cached realtime token is
      // stale. Drop it and re-open the socket (which re-fetches a fresh token in
      // the auth callback) rather than leaving the user stuck — the gateway has
      // already disconnected us, and Socket.IO won't retry that on its own.
      if (e.code === 'UNAUTHORIZED' && authRetries < MAX_AUTH_RETRIES) {
        authRetries += 1;
        clearRealtimeToken();
        setTimeout(() => {
          if (socketRef.current === socket) socket.connect();
        }, 600);
        return; // stay quiet while we self-heal
      }
      setNotice(e.message);
      setTimeout(() => setNotice(null), 4000);
    });
    // Class is over, in every org. The instructor already heard the class-end
    // sound from their own End action, so only students play it here.
    socket.on('room:ended', () => {
      stopBuzzerTone();
      if (!isInstructor) playClassEndTone();
    });
    // The instructor ended class and this org removes students on end. The
    // instructor navigates from their own End action, so only students act here.
    socket.on('room:closed', (payload?: { reason?: string }) => {
      if (isInstructor && payload?.reason !== 'ACCESS_REVOKED') return;
      socket.emit('room:leave', { sessionId });
      router.push(`/courses/${courseId}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, me.userId, teaching]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep the ref in sync so the (once-registered) socket handler reads the live
  // panel. Clearing the unread badge is done where chat is opened (openChat), not
  // here, to avoid a setState-in-effect cascade.
  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  // On phones the side panel overlays the board, so start with it CLOSED on
  // first load — the user opens chat from the bottom bar. Desktop keeps the
  // chat open by default (it sits beside the stage, not over it). Runs once on
  // mount so it only sets the initial state, never fighting later toggles.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initial-state adjustment for mobile
      setPanel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the chat tab and clear the unread badge in one go. Used by both the
  // bottom-bar chat toggle and the panel's own Chat tab.
  const openChat = () => {
    setPanel('chat');
    clearUnread();
  };

  // Grow the active recitation to cover wherever the mushaf goes: same surah →
  // widen the ayah span to include the current ayah; a new surah → restart the
  // span there. The draft's range thus tracks the whole session's reading.
  useEffect(() => {
    setHifzDraft((d) => {
      if (!d) return d;
      if (quranPos.surah !== d.surah) {
        return {
          ...d,
          surah: quranPos.surah,
          ayahStart: quranPos.ayah,
          ayahEnd: quranPos.ayah,
        };
      }
      const ayahStart = Math.min(d.ayahStart, quranPos.ayah);
      const ayahEnd = Math.max(d.ayahEnd, quranPos.ayah);
      if (ayahStart === d.ayahStart && ayahEnd === d.ayahEnd) return d;
      return { ...d, ayahStart, ayahEnd };
    });
  }, [quranPos.surah, quranPos.ayah]);

  // Buzzer questions for this session (instructor-only endpoint).
  useEffect(() => {
    if (!isInstructor) return;
    (async () => {
      try {
        const token = await getRealtimeToken();
        const res = await fetch(`${API_URL}/quizzes?sessionId=${sessionId}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        const quizzes: {
          questions: { id: string; body: string; timeLimitSec: number }[];
        }[] = res.ok ? await res.json() : [];
        const qs = quizzes.flatMap((q) => q.questions);
        setQuestions(qs);
        if (qs.length > 0) setSelectedQuestion(qs[0].id);
      } catch {
        setQuestions([]);
      }
    })();
  }, [isInstructor, sessionId]);

  // Drive the buzzer countdown: tick the clock while a round is open. The
  // baseline is reset in the socket handler, so this only advances `now`.
  useEffect(() => {
    if (buzzer?.phase !== 'QUESTION_OPEN') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [buzzer?.phase, buzzer?.question?.questionId]);

  // Prime the WebAudio context on the first user gesture. Mobile browsers start
  // every AudioContext suspended and only let it resume from inside a user
  // gesture — so the buzzer cue (which fires later, from a socket event) stayed
  // silent on phones. Creating + resuming it here, on the first tap/key, unlocks
  // audio for the rest of the session. One-shot: it removes itself once done.
  useEffect(() => {
    const unlock = () => {
      try {
        type ACtor = typeof AudioContext;
        const Ctor: ACtor | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: ACtor })
            .webkitAudioContext;
        if (Ctor) {
          const ctx = audioCtxRef.current ?? (audioCtxRef.current = new Ctor());
          if (ctx.state === 'suspended') void ctx.resume();
        }
      } catch {
        /* audio unavailable — ignore */
      }
      // The tone player's context needs the same gesture — the buzzer question
      // tone plays through it — and warming the recorded tones now means the
      // first one plays on time instead of after a download.
      primeTones();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Last line of defence for the question tone: leaving the room, or the class
  // ending, while a round is still open. Without this the loop would outlive
  // the classroom it belongs to and keep playing over whatever came next.
  useEffect(() => stopAllToneLoops, []);

  // Tear down the audio context + any pending auto-close on unmount.
  useEffect(
    () => () => {
      if (buzzerDismissRef.current) clearTimeout(buzzerDismissRef.current);
      void audioCtxRef.current?.close().catch(() => {});
    },
    [],
  );

  // Instructor drives the surface for the whole room; students just follow.
  const changeView = (next: StageView) => {
    if (!isInstructor) return;
    setView(next);
    socketRef.current?.emit('view:change', { sessionId, view: next });
  };

  // When the instructor starts sharing their screen from a non-Room surface,
  // pull the class to the Room view so students actually see the share — the
  // board/mushaf would otherwise cover it. Only fires on the off→on edge, so the
  // instructor can still switch surfaces again while sharing.
  const prevScreenOnRef = useRef(false);
  useEffect(() => {
    const on = videoControls?.screenOn ?? false;
    if (isInstructor && on && !prevScreenOnRef.current && view !== 'video') {
      changeView('video');
    }
    prevScreenOnRef.current = on;
    // changeView is intentionally omitted — it isn't memoised and the edge guard
    // above already makes this fire once per share.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoControls?.screenOn, isInstructor, view]);

  // Kick off a buzzer round from the dock. Open to every student in the room —
  // first correct answer wins. Needs at least one authored question.
  const startBuzzer = () => {
    if (!isInstructor) return;
    if (questions.length === 0) {
      // Nothing authored yet — let the instructor create one on the spot and
      // launch the round the moment it saves.
      setStartBuzzerOnCreate(true);
      setBuzzerForm(true);
      return;
    }
    // Let the instructor choose which question to broadcast.
    setBuzzerPicker(true);
  };

  // Broadcast a specific buzzer question (from the picker or the side panel).
  const broadcastBuzzer = (questionId: string) => {
    socketRef.current?.emit('buzzer:start', { sessionId, questionId });
    setSelectedQuestion(questionId);
    setBuzzerPicker(false);
    setPanel('points');
  };

  const onBuzzerCreated = (q: NewBuzzerQuestion, start: boolean) => {
    setQuestions((prev) => [...prev, q]);
    setSelectedQuestion(q.id);
    setBuzzerForm(false);
    setStartBuzzerOnCreate(false);
    if (start) {
      socketRef.current?.emit('buzzer:start', { sessionId, questionId: q.id });
    }
    setPanel('points');
  };

  // Instructor turns the shared mushaf; the position broadcasts to everyone.
  const navigateQuran = (surah: number, ayah: number) => {
    if (!isInstructor) return;
    setQuranPos({ surah, ayah });
    socketRef.current?.emit('quran:navigate', { sessionId, surah, ayah });
  };

  const leaveTemporarily = () =>
    startEnding(async () => {
      socketRef.current?.disconnect();
      router.push(`/courses/${courseId}`);
    });

  const endSessionForAll = () =>
    startEnding(async () => {
      if (isInstructor) {
        // Auto-save any recitation still being logged before the room closes.
        if (hifzDraft) {
          try {
            await submitHifzDraft(courseId, sessionId, hifzDraft);
            setHifzDraft(null);
          } catch {
            // Best-effort — don't block ending class on a failed log.
          }
        }
        await endSession(sessionId, courseId);
        // Played here rather than on `room:ended`: this client navigates away
        // straight after, before that event could reach it.
        playClassEndTone();
      }
      socketRef.current?.disconnect();
      router.push(`/courses/${courseId}`);
    });

  const leave = isInstructor ? endSessionForAll : leaveTemporarily;

  const chatLockedForMe = locked && !isInstructor;

  // Active indicator for the overflow "More" sheet
  const moreActive =
    panel === 'curriculum' ||
    panel === 'hifz' ||
    panel === 'work' ||
    panel === 'coding' ||
    dataSaver ||
    locked;

  return (
    <div
      data-stage-view={view}
      className="room-shell fixed inset-0 z-40 flex flex-col bg-[var(--room-bg)] text-neutral-100"
      data-room-scheme={scheme}
    >
      {/* ---------- Top ambient bar ---------- */}
      <header className="relative z-20 flex items-center justify-between gap-2 border-b border-white/10 bg-neutral-900/60 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {/* On-air badge */}
          {connected && instructorPresent && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-300">
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden />
              Live
            </span>
          )}
          {/* Connection status */}
          <span
            role="status"
            aria-live="polite"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              connected
                ? 'bg-signal-500/15 text-signal-300'
                : 'bg-amber-500/15 text-amber-300',
            )}
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                connected ? 'animate-live bg-signal-400' : 'bg-amber-400',
              )}
              aria-hidden
            />
            <span className={connected ? 'hidden md:inline' : 'inline'}>
              {connected ? 'Connected' : 'Connecting…'}
            </span>
          </span>
          {isShadow && (
            <span
              data-shadow-badge
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-300"
            >
              Shadowing
            </span>
          )}
          <h1 className="max-w-[130px] truncate text-xs font-semibold text-white sm:max-w-[220px] sm:text-sm md:max-w-xs">
            {courseTitle}
          </h1>
        </div>


        {/* Right: Record, Theme, Participants */}
        <div className="flex shrink-0 items-center gap-2">
          {isInstructor && <RecordButton sessionId={sessionId} />}
          {isInstructor && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setSchemePicker((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={schemePicker}
                aria-label="Change room colour scheme"
                title="Room colour scheme"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-200 transition hover:bg-white/15"
              >
                <PiPalette className="h-3.5 w-3.5" />
                <span
                  className="h-3 w-3 rounded-full ring-1 ring-white/30"
                  style={{ backgroundColor: SCHEME_META[scheme].swatch }}
                  aria-hidden
                />
              </button>
              {schemePicker && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setSchemePicker(false)}
                    className="fixed inset-0 z-[998] cursor-default"
                  />
                  <div
                    role="menu"
                    aria-label="Room colour scheme"
                    className="absolute right-0 top-full z-[999] mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl"
                  >
                    <p className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">
                      Room colour
                    </p>
                    {SCHEMES.map((s) => (
                      <button
                        key={s}
                        role="menuitemradio"
                        aria-checked={scheme === s}
                        onClick={() => {
                          setScheme(s);
                          socketRef.current?.emit('theme:change', {
                            sessionId,
                            scheme: s,
                          });
                          setSchemePicker(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition',
                          scheme === s
                            ? 'bg-white/10 text-white'
                            : 'text-neutral-300 hover:bg-white/5',
                        )}
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
                          style={{
                            background: `linear-gradient(135deg, ${SCHEME_META[s].swatch} 55%, ${SCHEME_META[s].bg} 55%)`,
                          }}
                          aria-hidden
                        />
                        <span className="flex-1">{SCHEME_META[s].label}</span>
                        {scheme === s && (
                          <span className="text-signal-400" aria-hidden>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={() => setPanel(panel === 'people' ? null : 'people')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition',
              panel === 'people'
                ? 'bg-white text-neutral-950'
                : 'bg-white/10 text-neutral-300 hover:bg-white/15'
            )}
            title="Cohort Roster"
          >
            <PiUsers className="h-3.5 w-3.5" />
            <span>{users.length}</span>
          </button>
        </div>
      </header>

      {/* ---------- Body: stage + side panel ---------- */}
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-3">
          {/* Both surfaces stay mounted so switching never drops call or board. */}
          {/* Video stays mounted always. In the Video view it fills the stage;
              on any other surface it shrinks to a presence filmstrip in the
              corner (pointer-events off so it never blocks the board). */}
          <div
            aria-hidden={view !== 'video'}
            className={cn(
              view === 'video'
                ? 'absolute inset-3'
                : // On board / mushaf / code the presence filmstrip is hidden —
                  // faces already live in the Room tab, and a floating strip only
                  // collided with those surfaces' own toolbars. Kept mounted (not
                  // unmounted) so audio keeps playing and switching back to Room
                  // is instant.
                  'pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0',
            )}
          >
            <VideoStage
              sessionId={sessionId}
              teaching={teaching}
              dataSaver={dataSaver}
              onControls={setVideoControls}
              compact={view !== 'video'}
              canSpeak={canSpeak}
            />
          </div>
          <div className={cn('absolute inset-3', view === 'board' ? '' : 'hidden')}>
            <BoardExcalidraw
              sessionId={sessionId}
              canDraw={isInstructor}
              teaching={teaching}
              quran={islamicEducation ? { tajweed } : null}
              maths={mathsSciences}
            />
          </div>
          {/* Only mounted when the Islamic Education pack is on, so a plain
              classroom never opens the shared mushaf (mirrors CodeBoard). */}
          {islamicEducation && (
            <div className={cn('absolute inset-3', view === 'quran' ? '' : 'hidden')}>
              <QuranReader
                surah={quranPos.surah}
                ayah={quranPos.ayah}
                isInstructor={isInstructor}
                onNavigate={navigateQuran}
                tajweed={tajweed}
              />
            </div>
          )}
          {/* Only mounted when the pack is on, so a plain classroom never opens
              the /code socket. Kept mounted across view switches once present. */}
          {codeInstruction && (
            <div className={cn('absolute inset-3', view === 'code' ? '' : 'hidden')}>
              <CodeBoard sessionId={sessionId} canEdit={isInstructor} />
            </div>
          )}

          {/* Waiting for instructor — covers the whole stage for students. */}
          {waitingForInstructor && (
            <div className="absolute inset-3 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-neutral-900/95 px-6 text-center">
              <PiChalkboardTeacher className="h-12 w-12 text-neutral-400" aria-hidden />
              <p className="font-display text-2xl font-extrabold tracking-tight text-white">
                Your instructor will join you soon
              </p>
              <p className="flex items-center gap-2 text-sm text-neutral-300">
                <span className="animate-live h-2 w-2 rounded-full bg-signal-400" />
                You&apos;re in the room — hang tight, class is about to begin.
              </p>
            </div>
          )}

          {/* Hand-wave popups (top-right of the stage). */}
          <div className="pointer-events-none absolute right-5 top-4 z-30 flex flex-col items-end gap-2">
            {waves.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-neutral-900 shadow-lg"
              >
                <PiHandWaving className="animate-wave h-5 w-5 text-signal-600" />
                {w.name} raised their hand
              </div>
            ))}
          </div>

          {/* Picked-to-speak toast. */}
          {picked && (
            <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-signal-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              <PiMicrophoneStage className="h-5 w-5" />
              <strong className="font-semibold">{picked.name}</strong> was picked
              to speak!
            </div>
          )}

          {/* Raised-hand queue — surfaced on the stage so the instructor can
              call on someone without opening a panel. Uses the existing
              pick-random event; the buzzer card (below) sits centre-bottom. */}
          {isInstructor && hands.length > 0 && (
            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2.5 rounded-2xl border border-white/15 bg-neutral-900/90 px-3 py-2 backdrop-blur">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <PiHandPalm className="h-4 w-4 text-signal-400" />
                {hands.length} {hands.length === 1 ? 'hand' : 'hands'}
              </span>
              <span className="max-w-[150px] truncate text-sm text-neutral-300">
                {hands[0].name}
                {hands.length > 1 && ` +${hands.length - 1}`}
              </span>
              <button
                onClick={() =>
                  socketRef.current?.emit('student:pick-random', { sessionId })
                }
                className={ctrl('on', 'py-1.5')}
              >
                <PiShuffle className="h-4 w-4" />
                Pick to speak
              </button>
            </div>
          )}

          {/* Buzzer question card floats at the bottom of the stage. */}
          {buzzer?.question &&
            (buzzer.phase === 'QUESTION_OPEN' ||
              buzzer.phase === 'WINNER' ||
              buzzer.phase === 'TIMEOUT') && (
              <div className="absolute inset-x-4 bottom-4 z-30 mx-auto max-w-xl overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-signal-50 px-5 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-signal-700">
                    <PiLightning className="h-4 w-4" /> Buzzer round
                    <span className="text-signal-600/70">
                      · {buzzer.question.points} pts
                    </span>
                  </span>
                  {buzzerRemaining !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums',
                        buzzerRemaining <= 5
                          ? 'animate-pulse bg-rose-100 text-rose-700'
                          : 'bg-white text-signal-700',
                      )}
                      aria-live="off"
                    >
                      ⏱ {buzzerRemaining}s
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="font-medium text-neutral-900">
                    {buzzer.question.body}
                  </p>
                  {buzzer.phase === 'QUESTION_OPEN' ? (
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {buzzer.question.options.map((opt, i) => {
                        const isPicked = pickedAnswer === i;
                        return (
                          <button
                            key={i}
                            disabled={
                              isInstructor ||
                              answerResult !== null ||
                              buzzerRemaining === 0 ||
                              !buzzer.eligibleUserIds.includes(me.userId)
                            }
                            onClick={() => {
                              setPickedAnswer(i);
                              socketRef.current?.emit('quiz:answer', {
                                sessionId,
                                questionId: buzzer.question!.questionId,
                                answerIndex: i,
                              });
                            }}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium text-neutral-800 transition',
                              'hover:border-signal-400 hover:bg-signal-50 active:scale-[0.98]',
                              'disabled:hover:border-neutral-300 disabled:hover:bg-white',
                              isPicked
                                ? 'border-signal-500 bg-signal-50 ring-2 ring-signal-500/40 disabled:opacity-100 disabled:hover:border-signal-500 disabled:hover:bg-signal-50'
                                : 'border-neutral-300 bg-white disabled:opacity-50',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold',
                                isPicked
                                  ? 'bg-signal-600 text-white'
                                  : 'bg-neutral-100 text-neutral-500',
                              )}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : buzzer.phase === 'WINNER' ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-signal-50 px-4 py-3 text-sm font-medium text-signal-700">
                      🏆 {buzzer.winner?.name} answered first — +
                      {buzzer.question.points} points!
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                      ⏱ Time&apos;s up. Nobody got it.
                    </div>
                  )}
                  {answerResult !== null && buzzer.phase === 'QUESTION_OPEN' && (
                    <p
                      className={cn(
                        'mt-3 flex items-center gap-1.5 text-sm font-medium',
                        answerResult ? 'text-signal-600' : 'text-rose-600',
                      )}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
                        {answerResult ? (
                          <path d="m5 10.5 3.2 3.2L15 6.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        )}
                      </svg>
                      {answerResult ? 'Correct!' : 'Not quite.'}
                    </p>
                  )}
                </div>
              </div>
            )}
        </main>

        {/* ---------- Right panel: chat / people ----------
            On phones it overlays the stage as a right-hand sheet (with a tap-
            away scrim) instead of squeezing the stage; from md up it's an
            in-flow column beside the stage as before. */}
        {panel && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setPanel(null)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
        {panel && (
          <aside
            data-chat-panel
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-white/15 bg-neutral-900/98 shadow-2xl backdrop-blur-2xl md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:border-white/10 md:bg-[var(--room-panel)] md:shadow-none lg:w-[350px]"
          >
            {/* Mobile touch drag handle */}
            <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-white/20 md:hidden" />

            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {panel === 'chat'
                    ? 'Cohort Chat'
                    : panel === 'people'
                    ? `Participants (${users.length})`
                    : panel === 'points'
                    ? 'Leaderboard'
                    : panel === 'curriculum'
                    ? 'Curriculum Checklist'
                    : panel === 'hifz'
                    ? 'Hifz Recitation Log'
                    : panel === 'coding'
                    ? 'Coding Task'
                    : 'Assignment Grading'}
                </span>
                {unreadChat > 0 && panel !== 'chat' && (
                  <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {(['chat', 'people', 'points'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => (t === 'chat' ? openChat() : setPanel(t))}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-lg text-xs font-semibold transition',
                      panel === t
                        ? 'bg-white/15 text-white'
                        : 'text-neutral-400 hover:text-white',
                    )}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                  >
                    {t === 'chat' ? (
                      <PiChatCircle className="h-4 w-4" />
                    ) : t === 'people' ? (
                      <PiUsers className="h-4 w-4" />
                    ) : (
                      <PiTrophy className="h-4 w-4" />
                    )}
                  </button>
                ))}
                {isInstructor && (
                  <button
                    onClick={() => setPanel('curriculum')}
                    aria-label="Curriculum"
                    title="Curriculum"
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-lg text-xs transition',
                      panel === 'curriculum'
                        ? 'bg-white/15 text-white'
                        : 'text-neutral-400 hover:text-white',
                    )}
                  >
                    <PiListChecks className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setPanel(null)}
                  aria-label="Close panel"
                  className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-neutral-400 transition hover:bg-white/10 hover:text-white"
                >
                  <PiX className="h-4 w-4" />
                </button>
              </div>
            </div>

            {panel === 'chat' ? (
              <>
                <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3 text-sm">
                  {messages.length === 0 && (
                    <p className="py-6 text-center text-xs text-neutral-500">
                      No messages yet. Say hello 👋
                    </p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className="leading-relaxed">
                      <span
                        className={cn(
                          'font-semibold',
                          m.user.role === 'INSTRUCTOR'
                            ? 'text-signal-400'
                            : 'text-white',
                        )}
                      >
                        {m.user.name}
                      </span>
                      {m.audioUrl ? (
                        <span className="mt-1 block">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <audio
                            controls
                            src={m.audioUrl}
                            className="h-9 w-full max-w-[240px]"
                          />
                        </span>
                      ) : (
                        <span className="text-neutral-300"> {m.body}</span>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                {isShadow ? (
                  <p className="border-t border-white/10 p-3 text-center text-xs text-neutral-500">
                    You&apos;re shadowing this class — read only.
                  </p>
                ) : (
                <form
                  className="flex gap-2 border-t border-white/10 p-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(e.currentTarget);
                  }}
                >
                  <input
                    name="body"
                    placeholder={chatLockedForMe ? 'Chat is locked' : 'Say something…'}
                    disabled={chatLockedForMe}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:border-signal-500 focus:outline-none focus:ring-4 focus:ring-signal-500/10 disabled:opacity-50"
                  />
                  {/* Voice-note recording temporarily disabled — re-enable by
                      un-commenting this button (handlers/state are kept intact).
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={chatLockedForMe || uploadingVoice}
                    className={ctrl(recording ? 'danger' : 'default', 'px-3 py-1.5')}
                    aria-label={
                      recording ? 'Stop and send voice note' : 'Record voice note'
                    }
                    title={recording ? 'Stop & send' : 'Record a voice note'}
                  >
                    {uploadingVoice ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : recording ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-live h-2 w-2 rounded-full bg-white" />
                        Stop
                      </span>
                    ) : (
                      <PiMicrophone className="h-4 w-4" />
                    )}
                  </button>
                  */}
                  <button
                    disabled={chatLockedForMe}
                    className={ctrl('on', 'px-4 py-1.5')}
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </form>
                )}
              </>
            ) : panel === 'people' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-1.5">
                  {users.map((u) => {
                    const handUp = hands.some((h) => h.userId === u.userId);
                    return (
                      <li key={u.userId} className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                            avatarColor(u.userId),
                          )}
                          aria-hidden
                        >
                          {initials(u.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                          {u.name}
                          {u.role === 'INSTRUCTOR' && (
                            <span className="ml-1.5 rounded bg-signal-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-signal-300">
                              host
                            </span>
                          )}
                        </span>
                        {handUp && (
                          <PiHandPalm
                            className="h-4 w-4 shrink-0 text-signal-400"
                            title="Hand raised"
                          />
                        )}
                        {/* Instructor grants / revokes the mic per student. */}
                        {isInstructor && u.role === 'STUDENT' ? (
                          <button
                            onClick={() =>
                              socketRef.current?.emit(
                                speakers.includes(u.userId)
                                  ? 'mic:revoke'
                                  : 'mic:grant',
                                { sessionId, userId: u.userId },
                              )
                            }
                            aria-label={
                              speakers.includes(u.userId)
                                ? `Mute ${u.name}`
                                : `Let ${u.name} speak`
                            }
                            title={
                              speakers.includes(u.userId)
                                ? 'Revoke mic'
                                : 'Grant mic'
                            }
                            className={cn(
                              'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition',
                              speakers.includes(u.userId)
                                ? 'bg-signal-600 text-white hover:bg-signal-500'
                                : 'text-neutral-400 hover:bg-white/10 hover:text-white',
                            )}
                          >
                            {speakers.includes(u.userId) ? (
                              <PiMicrophone className="h-4 w-4" />
                            ) : (
                              <PiMicrophoneSlash className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          !isInstructor &&
                          speakers.includes(u.userId) && (
                            <PiMicrophone
                              className="h-4 w-4 shrink-0 text-signal-400"
                              title="Can speak"
                            />
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : panel === 'points' ? (
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* Points */}
                {leaderboard.length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-500">
                    No points awarded yet. Win a buzzer round to climb the board.
                  </p>
                )}
                {leaderboard.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Student points
                    </h3>
                    <ol className="mt-2 space-y-0.5">
                      {leaderboard.slice(0, 10).map((row) => {
                        const isMe = row.userId === me.userId;
                        return (
                          <li
                            key={row.userId}
                            className={cn(
                              'flex items-center justify-between rounded-lg px-2 py-1.5',
                              isMe && 'bg-signal-500/10',
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 text-center text-sm">
                                {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
                              </span>
                              <span
                                className={cn(
                                  'text-sm',
                                  isMe
                                    ? 'font-semibold text-signal-300'
                                    : 'text-neutral-200',
                                )}
                              >
                                {row.name}
                                {isMe && ' (you)'}
                              </span>
                            </span>
                            <span className="font-mono text-sm font-semibold text-neutral-300">
                              {row.points}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Buzzer (instructor) */}
                {isInstructor && (
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-signal-400">
                        <PiLightning className="h-3.5 w-3.5" /> Buzzer
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setStartBuzzerOnCreate(false);
                          setBuzzerForm(true);
                        }}
                        className="text-xs font-semibold text-signal-400 transition hover:text-signal-300"
                      >
                        + New question
                      </button>
                    </div>
                    {questions.length === 0 ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        No buzzer questions yet. Add one to run a round.
                      </p>
                    ) : (
                      <>
                        <select
                          value={selectedQuestion}
                          onChange={(e) => setSelectedQuestion(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-signal-500 focus:outline-none focus:ring-4 focus:ring-signal-500/10"
                        >
                          {questions.map((q) => (
                            <option
                              key={q.id}
                              value={q.id}
                              className="text-neutral-900"
                            >
                              {q.body} ({q.timeLimitSec}s)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            socketRef.current?.emit('buzzer:start', {
                              sessionId,
                              questionId: selectedQuestion || questions[0].id,
                            })
                          }
                          disabled={buzzer?.phase === 'QUESTION_OPEN'}
                          className={ctrl('on', 'mt-2 w-full justify-center')}
                        >
                          Start round
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : panel === 'curriculum' ? (
              <LiveCurriculumPanel courseId={courseId} />
            ) : panel === 'hifz' ? (
              <LiveHifzPanel
                courseId={courseId}
                sessionId={sessionId}
                quranPos={quranPos}
                draft={hifzDraft}
                setDraft={setHifzDraft}
              />
            ) : panel === 'coding' ? (
              <LiveCodingPanel
                sessionId={sessionId}
                courseId={courseId}
                isInstructor={isInstructor}
                task={codingTask}
                points={codingPoints}
                reviews={codingReviews}
              />
            ) : (
              <LiveGradingPanel
                courseId={courseId}
                sessionId={sessionId}
                refreshSignal={submissionPing}
              />
            )}
          </aside>
        )}
      </div>

      {/* ---------- Modern Google Minimalist Dock ---------- */}
      <footer className="relative z-30 flex items-center justify-center p-2 sm:p-2.5 bg-neutral-950/40 backdrop-blur-md border-t border-white/5">
        <div className="flex max-w-full items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:gap-2.5">
          {/* Island 1: Media Core (Mic, Cam, Screen, End) */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-neutral-900/90 p-1 shadow-xl backdrop-blur-xl sm:gap-1.5 sm:p-1.5">
            {/* Mic */}
            {!isShadow && videoControls?.canPublishMedia && (
              <button
                onClick={videoControls.toggleMic}
                disabled={!canSpeak}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full transition sm:h-10 sm:w-10',
                  !canSpeak
                    ? 'cursor-not-allowed bg-white/5 text-neutral-400 opacity-40'
                    : videoControls.micOn
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'border border-rose-500/30 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25',
                )}
                title={
                  !canSpeak
                    ? 'The instructor grants the mic — raise your hand to ask to speak'
                    : videoControls.micOn
                    ? 'Mute microphone'
                    : 'Unmute microphone'
                }
              >
                {videoControls.micOn && canSpeak ? (
                  <PiMicrophone className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <PiMicrophoneSlash className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            )}

            {/* Cam */}
            {!isShadow && videoControls?.canPublishMedia && (
              <button
                onClick={videoControls.toggleCam}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full transition sm:h-10 sm:w-10',
                  videoControls.camOn
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'bg-white/10 text-neutral-300 hover:bg-white/20',
                )}
                title={videoControls.camOn ? 'Turn camera off' : 'Turn camera on'}
              >
                {videoControls.camOn ? (
                  <PiVideoCamera className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <PiVideoCameraSlash className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            )}

            {/* Screenshare */}
            {!isShadow && videoControls?.canShareScreen && (
              <button
                onClick={videoControls.toggleScreen}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full transition sm:h-10 sm:w-10',
                  videoControls.screenOn
                    ? 'bg-signal-500 text-neutral-950 shadow-sm'
                    : 'bg-white/10 text-neutral-300 hover:bg-white/20',
                )}
                title={videoControls.screenOn ? 'Stop sharing screen' : 'Share screen'}
              >
                <PiScreencast className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}

            {/* Leave / End Class */}
            <button
              onClick={() => setConfirmLeave(true)}
              disabled={ending}
              className="grid h-9 w-9 place-items-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500 active:scale-95 disabled:opacity-40 sm:h-10 sm:w-10"
              title={
                ending
                  ? isInstructor
                    ? 'Ending session…'
                    : 'Leaving room…'
                  : isInstructor
                  ? 'End class for all'
                  : 'Leave room'
              }
            >
              {isInstructor ? (
                <PiPhoneX className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <PiSignOut className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>

          {/* Island 2: Surface Switcher (Brought down from header) */}
          <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-neutral-900/90 p-1 shadow-xl backdrop-blur-xl">
            {isInstructor ? (
              <div className="flex items-center gap-1">
                {views.map((v) => {
                  const { label, Icon } = VIEW_META[v];
                  const isActive = view === v;
                  return (
                    <button
                      key={v}
                      onClick={() => changeView(v)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-2',
                        isActive
                          ? 'bg-white text-neutral-950 shadow-sm'
                          : 'text-neutral-300 hover:bg-white/10 hover:text-white',
                      )}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden md:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              (() => {
                const { label, Icon } = VIEW_META[view];
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200">
                    <Icon className="h-4 w-4 text-signal-400" />
                    <span className="hidden sm:inline text-neutral-400">Following · </span>
                    <span>{label}</span>
                  </span>
                );
              })()
            )}
          </div>

          {/* Island 3: Context Action Capsule (Buzzer for Host, Raise Hand for Student) */}
          <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-neutral-900/90 p-1 shadow-xl backdrop-blur-xl sm:p-1.5">
            {isInstructor ? (
              <button
                onClick={startBuzzer}
                disabled={buzzer?.phase === 'QUESTION_OPEN'}
                className="inline-flex items-center gap-1.5 rounded-full bg-signal-500 px-3 py-1.5 text-xs font-bold text-neutral-950 shadow-md transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-2 sm:text-sm"
                title={
                  buzzer?.phase === 'QUESTION_OPEN'
                    ? 'A buzzer question is already active'
                    : 'Start a buzzer competition round'
                }
              >
                <PiLightning className="h-4 w-4" />
                <span>{buzzer?.phase === 'QUESTION_OPEN' ? 'Round Active' : 'Start Buzzer'}</span>
              </button>
            ) : !isShadow ? (
              <button
                onClick={() =>
                  socketRef.current?.emit(
                    myHandRaised ? 'hand:lower' : 'hand:raise',
                    { sessionId },
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition sm:px-4 sm:py-2 sm:text-sm',
                  myHandRaised
                    ? 'bg-signal-600 text-white hover:bg-signal-500'
                    : 'bg-white text-neutral-950 hover:bg-neutral-100',
                )}
                title={myHandRaised ? 'Lower your hand' : 'Raise hand to speak'}
              >
                <PiHandPalm className="h-4 w-4" />
                <span>{myHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>
            ) : null}
          </div>

          {/* Island 4: Progressive Disclosure & Tools (Houses Chat, People, Leaderboard) */}
          <div className="relative flex shrink-0 items-center rounded-full border border-white/10 bg-neutral-900/90 p-1 shadow-xl backdrop-blur-xl sm:p-1.5">
            {/* More (⋮) Overflow Toggle with Unread Badge */}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                'relative grid h-9 w-9 place-items-center rounded-full transition sm:h-10 sm:w-10',
                moreOpen || moreActive
                  ? 'bg-white text-neutral-950'
                  : 'bg-white/10 text-neutral-300 hover:bg-white/20',
              )}
              title="More Classroom Tools & Collaboration"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <PiDotsThreeOutline className="h-5 w-5" />
              {unreadChat > 0 && panel !== 'chat' && (
                <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </button>

            {/* Progressive Disclosure Popover Sheet */}
            {moreOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMoreOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  role="menu"
                  aria-label="More classroom tools"
                  className="absolute bottom-full right-0 z-50 mb-3 w-72 overflow-hidden rounded-2xl border border-white/15 bg-neutral-900/98 p-3 shadow-2xl backdrop-blur-2xl"
                >
                  {/* Category 1: Cohort Collaboration (Chat, People, Leaderboard) */}
                  <div className="mb-2 border-b border-white/10 pb-2">
                    <p className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                      Cohort Collaboration
                    </p>
                    <button
                      onClick={() => {
                        openChat();
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <PiChatCircle className="h-4 w-4 text-signal-400" />
                        <span>Cohort Chat</span>
                      </span>
                      {unreadChat > 0 && (
                        <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                          {unreadChat > 9 ? '9+' : unreadChat}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setPanel('people');
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        <PiUsers className="h-4 w-4 text-signal-400" />
                        <span>Participants & Rosters</span>
                      </span>
                      <span className="text-[11px] text-neutral-400">{users.length}</span>
                    </button>
                    <button
                      onClick={() => {
                        setPanel('points');
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <PiTrophy className="h-4 w-4 text-signal-400" />
                      <span>Leaderboard & Standings</span>
                    </button>
                  </div>

                  {/* Category 2: Teaching Tools */}
                  {(isInstructor || (codeInstruction && codingTask)) && (
                    <div className="mb-2 border-b border-white/10 pb-2">
                      <p className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                        Teaching Utilities
                      </p>
                      {isInstructor && (
                        <button
                          onClick={() => {
                            setPanel('curriculum');
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                        >
                          <PiListChecks className="h-4 w-4 text-signal-400" />
                          <span>Curriculum Checklist</span>
                        </button>
                      )}
                      {isInstructor && (
                        <button
                          onClick={() => {
                            setPanel('work');
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                        >
                          <PiClipboardText className="h-4 w-4 text-signal-400" />
                          <span>Grade Assignments</span>
                        </button>
                      )}
                      {isInstructor && islamicEducation && (
                        <button
                          onClick={() => {
                            setPanel('hifz');
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                        >
                          <PiBookOpenText className="h-4 w-4 text-signal-400" />
                          <span>Hifz Recitation Log</span>
                        </button>
                      )}
                      {codeInstruction && (isInstructor || codingTask) && (
                        <button
                          onClick={() => {
                            setPanel('coding');
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                        >
                          <PiCode className="h-4 w-4 text-signal-400" />
                          <span>Coding Task</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Category 3: Room Administration */}
                  <div>
                    <p className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                      Room Controls
                    </p>
                    {isInstructor && (
                      <button
                        onClick={() => {
                          socketRef.current?.emit('chat:lock', {
                            sessionId,
                            locked: !locked,
                          });
                          setMoreOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                      >
                        {locked ? (
                          <PiLockSimpleOpen className="h-4 w-4 text-amber-400" />
                        ) : (
                          <PiLockSimple className="h-4 w-4 text-neutral-400" />
                        )}
                        <span>{locked ? 'Unlock Chat' : 'Lock Chat'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDataSaver((v) => !v);
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <PiVideoCameraSlash className="h-4 w-4 text-neutral-400" />
                      <span>
                        {dataSaver ? 'Disable 2G Data Saver' : 'Enable 2G Data Saver'}
                      </span>
                    </button>
                    {isInstructor && (
                      <button
                        onClick={() => {
                          setSchemePicker(true);
                          setMoreOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                      >
                        <PiPalette className="h-4 w-4 text-neutral-400" />
                        <span>Room Colour Scheme</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Buzzer round launcher — pick which authored question to broadcast. */}
      {isInstructor && buzzerPicker && (
        <BuzzerPickerModal
          questions={questions}
          disabled={buzzer?.phase === 'QUESTION_OPEN'}
          onPick={broadcastBuzzer}
          onClose={() => setBuzzerPicker(false)}
          onCreateNew={() => {
            setBuzzerPicker(false);
            setStartBuzzerOnCreate(false);
            setBuzzerForm(true);
          }}
        />
      )}

      {/* Create-a-buzzer-question modal (instructor) */}
      {isInstructor && buzzerForm && (
        <BuzzerQuestionModal
          courseId={courseId}
          startOnCreate={startBuzzerOnCreate}
          onClose={() => {
            setBuzzerForm(false);
            setStartBuzzerOnCreate(false);
          }}
          onCreated={onBuzzerCreated}
        />
      )}

      {/* Confirm before ending / leaving the class */}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmLeave(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isInstructor ? 'Leave or End Class' : 'Leave class'}
            className="w-full max-w-md rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-neutral-950">
              {isInstructor ? 'Leave or end this class?' : 'Leave the class?'}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {isInstructor
                ? 'You can step out temporarily and rejoin at any time, or wrap up the session and conclude it for all students.'
                : 'You can rejoin while the class is still live.'}
            </p>

            {isInstructor ? (
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmLeave(false);
                    leaveTemporarily();
                  }}
                  disabled={ending}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-100 disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      Leave temporarily
                    </p>
                    <p className="text-xs text-neutral-500">
                      Students stay in the room. You can rejoin at any time.
                    </p>
                  </div>
                  <span className="text-sm font-bold text-neutral-700">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmLeave(false);
                    endSessionForAll();
                  }}
                  disabled={ending}
                  className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-rose-800">
                      End class for everyone
                    </p>
                    <p className="text-xs text-rose-600">
                      Concludes the live session, evicts students, and logs attendance.
                    </p>
                  </div>
                  <span className="text-sm font-bold text-rose-700">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  className="mt-2 self-center text-xs font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  Stay in class
                </button>
              </div>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className={btn('ghost', 'sm')}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmLeave(false);
                    leaveTemporarily();
                  }}
                  disabled={ending}
                  className={cn(
                    btn('primary', 'sm'),
                    'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500 focus-visible:ring-rose-500',
                  )}
                >
                  Leave
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transient error toast */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
