'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { endSession } from '@/app/actions/courses';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { avatarColor, btn, cn, initials } from '@/lib/ui';
import type {
  BuzzerState,
  ChatMessage,
  ClientToServerEvents,
  LeaderboardEntry,
  RoomUser,
  ServerToClientEvents,
  StageView,
} from '@/lib/realtime-contract';
import dynamic from 'next/dynamic';
import {
  PiBookOpenText,
  PiChalkboardTeacher,
  PiChatCircle,
  PiClipboardText,
  PiHandPalm,
  PiHandWaving,
  PiLightning,
  PiLockSimple,
  PiLockSimpleOpen,
  PiMicrophone,
  PiMicrophoneSlash,
  PiMicrophoneStage,
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
  LiveHifzPanel,
  submitHifzDraft,
  type HifzDraft,
} from './live-hifz-panel';
import { LiveGradingPanel } from './live-grading-panel';
import { QuranReader } from './quran-reader';

// tldraw touches browser-only APIs, so it must not render on the server.
const BoardTldraw = dynamic(
  () => import('./board-tldraw').then((m) => m.BoardTldraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
        Loading board…
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

interface Wave {
  id: string;
  name: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** The three shared surfaces the instructor can put the class on. */
const VIEW_META = {
  video: { label: 'Video', Icon: PiVideoCamera },
  board: { label: 'Chalkboard', Icon: PiChalkboardTeacher },
  quran: { label: 'Qur’an', Icon: PiBookOpenText },
} as const;
const VIEWS = ['video', 'board', 'quran'] as const;

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
}: {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  me: RoomUser;
}) {
  const router = useRouter();
  const [ending, startEnding] = useTransition();
  const socketRef = useRef<RoomSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [locked, setLocked] = useState(false);
  const [hands, setHands] = useState<RoomUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [buzzer, setBuzzer] = useState<BuzzerState | null>(null);
  const [picked, setPicked] = useState<RoomUser | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<StageView>('video');
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
  const [panel, setPanel] = useState<
    'chat' | 'people' | 'points' | 'hifz' | 'work' | null
  >('chat');
  const [videoControls, setVideoControls] = useState<VideoControls | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const handsRef = useRef<RoomUser[]>([]);
  const handsSeededRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isInstructor = me.role === 'INSTRUCTOR';
  const myHandRaised = hands.some((h) => h.userId === me.userId);
  // Students can join before the instructor arrives; until a host is present in
  // the room, they wait rather than staring at an empty call.
  const instructorPresent = users.some((u) => u.role === 'INSTRUCTOR');
  const waitingForInstructor = !isInstructor && connected && !instructorPresent;

  useEffect(() => {
    const socket: RoomSocket = io(API_URL, {
      // Async auth: the httpOnly cookie is fetched from a same-origin route.
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const pushWave = (name: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setWaves((w) => [...w, { id, name }]);
      setTimeout(() => setWaves((w) => w.filter((x) => x.id !== id)), 4500);
    };

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:presence', (p) => setUsers(p.users));
    socket.on('chat:history', (p) => setMessages(p.messages));
    socket.on('chat:message', (m) => setMessages((prev) => [...prev, m]));
    socket.on('chat:locked', (p) => setLocked(p.locked));
    socket.on('view:changed', (p) => setView(p.view));
    socket.on('quran:position', (p) =>
      setQuranPos({ surah: p.surah, ayah: p.ayah }),
    );
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
    socket.on('buzzer:state', (p) => {
      setBuzzer(p.state);
      if (p.state.phase === 'QUESTION_OPEN') setAnswerResult(null);
    });
    socket.on('quiz:answer-result', (p) => setAnswerResult(p.isCorrect));
    socket.on('student:picked', (p) => {
      setPicked(p.user);
      setTimeout(() => setPicked(null), 6000);
    });
    socket.on('error', (e) => {
      setNotice(e.message);
      setTimeout(() => setNotice(null), 4000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, me.userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const send = (form: HTMLFormElement) => {
    const input = form.elements.namedItem('body') as HTMLInputElement;
    const body = input.value.trim();
    if (!body) return;
    socketRef.current?.emit('chat:send', { sessionId, body });
    input.value = '';
  };

  // Instructor drives the surface for the whole room; students just follow.
  const changeView = (next: StageView) => {
    if (!isInstructor) return;
    setView(next);
    socketRef.current?.emit('view:change', { sessionId, view: next });
  };

  // Instructor turns the shared mushaf; the position broadcasts to everyone.
  const navigateQuran = (surah: number, ayah: number) => {
    if (!isInstructor) return;
    setQuranPos({ surah, ayah });
    socketRef.current?.emit('quran:navigate', { sessionId, surah, ayah });
  };

  const leave = () =>
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
      }
      router.push(`/courses/${courseId}`);
    });

  const chatLockedForMe = locked && !isInstructor;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-950 text-neutral-100">
      {/* ---------- Top bar ---------- */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              'inline-block h-2 w-2 shrink-0 rounded-full',
              connected ? 'animate-live bg-signal-500' : 'bg-neutral-500',
            )}
            title={connected ? 'Connected' : 'Connecting…'}
          />
          <h1 className="truncate text-sm font-semibold text-white">
            {courseTitle}
          </h1>
        </div>

        {/* Center: the surface switch (instructor drives it; students follow). */}
        <div className="flex shrink-0 items-center justify-center">
          {isInstructor ? (
            <div className="inline-flex rounded-full bg-white/10 p-1">
              {VIEWS.map((v) => {
                const { label, Icon } = VIEW_META[v];
                return (
                  <button
                    key={v}
                    onClick={() => changeView(v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                      view === v
                        ? 'bg-white text-neutral-950'
                        : 'text-neutral-300 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            (() => {
              const { label, Icon } = VIEW_META[view];
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-neutral-200">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              );
            })()
          )}
        </div>

        <div className="flex flex-1 items-center justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-300">
            <PiUsers className="h-3.5 w-3.5" />
            {users.length}
          </span>
        </div>
      </header>

      {/* ---------- Body: stage + side panel ---------- */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-3">
          {/* Both surfaces stay mounted so switching never drops call or board. */}
          <div className={cn('absolute inset-3', view === 'video' ? '' : 'hidden')}>
            <VideoStage
              sessionId={sessionId}
              dataSaver={dataSaver}
              onControls={setVideoControls}
            />
          </div>
          <div className={cn('absolute inset-3', view === 'board' ? '' : 'hidden')}>
            <BoardTldraw sessionId={sessionId} canDraw={isInstructor} />
          </div>
          <div className={cn('absolute inset-3', view === 'quran' ? '' : 'hidden')}>
            <QuranReader
              surah={quranPos.surah}
              ayah={quranPos.ayah}
              isInstructor={isInstructor}
              onNavigate={navigateQuran}
            />
          </div>

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

          {/* Buzzer question card floats at the bottom of the stage. */}
          {buzzer?.question &&
            (buzzer.phase === 'QUESTION_OPEN' ||
              buzzer.phase === 'WINNER' ||
              buzzer.phase === 'TIMEOUT') && (
              <div className="absolute inset-x-4 bottom-4 z-30 mx-auto max-w-xl overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-neutral-100 bg-signal-50 px-5 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-signal-700">
                    <PiLightning className="h-4 w-4" /> Buzzer round
                  </span>
                </div>
                <div className="p-5">
                  <p className="font-medium text-neutral-900">
                    {buzzer.question.body}
                  </p>
                  {buzzer.phase === 'QUESTION_OPEN' ? (
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {buzzer.question.options.map((opt, i) => (
                        <button
                          key={i}
                          disabled={
                            isInstructor ||
                            answerResult !== null ||
                            !buzzer.eligibleUserIds.includes(me.userId)
                          }
                          onClick={() =>
                            socketRef.current?.emit('quiz:answer', {
                              sessionId,
                              questionId: buzzer.question!.questionId,
                              answerIndex: i,
                            })
                          }
                          className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:border-signal-400 disabled:opacity-50 disabled:hover:border-neutral-300"
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-xs font-semibold text-neutral-500">
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : buzzer.phase === 'WINNER' ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-signal-50 px-4 py-3 text-sm font-medium text-signal-700">
                      🏆 {buzzer.winner?.name} answered first and earns the mic!
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                      ⏱ Time&apos;s up. Nobody got it.
                    </div>
                  )}
                  {answerResult !== null && buzzer.phase === 'QUESTION_OPEN' && (
                    <p
                      className={cn(
                        'mt-3 text-sm font-medium',
                        answerResult ? 'text-signal-600' : 'text-rose-600',
                      )}
                    >
                      {answerResult ? '✅ Correct!' : '❌ Not quite.'}
                    </p>
                  )}
                </div>
              </div>
            )}
        </main>

        {/* ---------- Right panel: chat / people ---------- */}
        {panel && (
          <aside className="flex w-full max-w-[360px] shrink-0 flex-col border-l border-white/10 bg-neutral-900">
            <div className="flex items-center gap-1 border-b border-white/10 p-2">
              {(['chat', 'people', 'points'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPanel(t)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition',
                    panel === t
                      ? 'bg-white/10 text-white'
                      : 'text-neutral-400 hover:text-white',
                  )}
                >
                  {t === 'chat' ? (
                    <>
                      <PiChatCircle className="h-4 w-4" /> Chat
                    </>
                  ) : t === 'people' ? (
                    <>
                      <PiUsers className="h-4 w-4" /> {users.length}
                    </>
                  ) : (
                    <>
                      <PiTrophy className="h-4 w-4" /> Points
                    </>
                  )}
                </button>
              ))}
              {isInstructor &&
                (['hifz', 'work'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPanel(t)}
                    aria-label={t === 'hifz' ? 'Hifz' : 'Grade assignments'}
                    className={cn(
                      'grid h-8 w-9 shrink-0 place-items-center rounded-lg transition',
                      panel === t
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:text-white',
                    )}
                    title={t === 'hifz' ? 'Hifz progress' : 'Grade assignments'}
                  >
                    {t === 'hifz' ? (
                      <PiBookOpenText className="h-4 w-4" />
                    ) : (
                      <PiClipboardText className="h-4 w-4" />
                    )}
                  </button>
                ))}
              <button
                onClick={() => setPanel(null)}
                aria-label="Close panel"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-white/10 hover:text-white"
              >
                <PiX className="h-4 w-4" />
              </button>
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
                    <p key={m.id} className="leading-relaxed">
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
                      <span className="text-neutral-300"> {m.body}</span>
                    </p>
                  ))}
                  <div ref={chatEndRef} />
                </div>
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
                  <button
                    disabled={chatLockedForMe}
                    className={ctrl('on', 'px-4 py-1.5')}
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </form>
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
                            className="h-4 w-4 text-signal-400"
                            title="Hand raised"
                          />
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
                {isInstructor && questions.length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-signal-400">
                      <PiLightning className="h-3.5 w-3.5" /> Buzzer
                    </h3>
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
                          questionId: selectedQuestion,
                        })
                      }
                      disabled={
                        hands.length === 0 || buzzer?.phase === 'QUESTION_OPEN'
                      }
                      title={hands.length === 0 ? 'Needs raised hands' : undefined}
                      className={ctrl('on', 'mt-2 w-full justify-center')}
                    >
                      Start round
                    </button>
                  </div>
                )}
              </div>
            ) : panel === 'hifz' ? (
              <LiveHifzPanel
                courseId={courseId}
                sessionId={sessionId}
                quranPos={quranPos}
                draft={hifzDraft}
                setDraft={setHifzDraft}
              />
            ) : (
              <LiveGradingPanel courseId={courseId} sessionId={sessionId} />
            )}
          </aside>
        )}
      </div>

      {/* ---------- Bottom control bar ---------- */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        {/* Center: media + hand */}
        <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
          {/* Data saver — everyone can toggle; drops video to save bandwidth. */}
          <button
            onClick={() => setDataSaver((v) => !v)}
            className={ctrl(dataSaver ? 'on' : 'default')}
            title="Turn video off to save data (audio + chalkboard stay live)"
          >
            <PiVideoCameraSlash className="h-4 w-4" />
            {dataSaver ? 'Data saver on' : 'Data saver'}
          </button>
          {videoControls?.canPublishMedia && (
            <>
              <button
                onClick={videoControls.toggleMic}
                className={ctrl(videoControls.micOn ? 'on' : 'default')}
              >
                {videoControls.micOn ? (
                  <PiMicrophone className="h-4 w-4" />
                ) : (
                  <PiMicrophoneSlash className="h-4 w-4" />
                )}
                {videoControls.micOn ? 'Mic on' : 'Mic'}
              </button>
              <button
                onClick={videoControls.toggleCam}
                className={ctrl(videoControls.camOn ? 'on' : 'default')}
              >
                {videoControls.camOn ? (
                  <PiVideoCamera className="h-4 w-4" />
                ) : (
                  <PiVideoCameraSlash className="h-4 w-4" />
                )}
                {videoControls.camOn ? 'Camera on' : 'Camera'}
              </button>
            </>
          )}
          {videoControls?.canShareScreen && (
            <button
              onClick={videoControls.toggleScreen}
              className={ctrl(videoControls.screenOn ? 'on' : 'default')}
            >
              <PiScreencast className="h-4 w-4" />
              {videoControls.screenOn ? 'Stop sharing' : 'Share screen'}
            </button>
          )}
          {!isInstructor && (
            <button
              onClick={() =>
                socketRef.current?.emit(
                  myHandRaised ? 'hand:lower' : 'hand:raise',
                  { sessionId },
                )
              }
              className={ctrl(myHandRaised ? 'on' : 'default')}
            >
              <PiHandPalm className="h-4 w-4" />
              {myHandRaised ? 'Lower hand' : 'Raise hand'}
            </button>
          )}
          {isInstructor && (
            <>
              <button
                onClick={() =>
                  socketRef.current?.emit('chat:lock', {
                    sessionId,
                    locked: !locked,
                  })
                }
                className={ctrl('default')}
              >
                {locked ? (
                  <PiLockSimpleOpen className="h-4 w-4" />
                ) : (
                  <PiLockSimple className="h-4 w-4" />
                )}
                {locked ? 'Unlock chat' : 'Lock chat'}
              </button>
              <button
                onClick={() =>
                  socketRef.current?.emit('student:pick-random', { sessionId })
                }
                disabled={hands.length === 0}
                className={ctrl('default')}
              >
                <PiShuffle className="h-4 w-4" />
                Pick hand ({hands.length})
              </button>
            </>
          )}
        </div>

        {/* Right: panel toggles + leave/end */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
            className={ctrl(panel === 'chat' ? 'on' : 'default', 'px-3')}
            aria-label="Toggle chat"
          >
            <PiChatCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => setPanel(panel === 'people' ? null : 'people')}
            className={ctrl(panel === 'people' ? 'on' : 'default', 'px-3')}
            aria-label="Toggle people"
          >
            <PiUsers className="h-5 w-5" />
          </button>
          {isInstructor && (
            <>
              <button
                onClick={() => setPanel(panel === 'hifz' ? null : 'hifz')}
                className={ctrl(panel === 'hifz' ? 'on' : 'default', 'px-3')}
                aria-label="Toggle hifz"
                title="Hifz progress"
              >
                <PiBookOpenText className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPanel(panel === 'work' ? null : 'work')}
                className={ctrl(panel === 'work' ? 'on' : 'default', 'px-3')}
                aria-label="Toggle grading"
                title="Grade assignments"
              >
                <PiClipboardText className="h-5 w-5" />
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmLeave(true)}
            disabled={ending}
            className={ctrl('danger')}
          >
            {isInstructor ? (
              <PiPhoneX className="h-4 w-4" />
            ) : (
              <PiSignOut className="h-4 w-4" />
            )}
            {ending
              ? isInstructor
                ? 'Ending…'
                : 'Leaving…'
              : isInstructor
                ? 'End class'
                : 'Leave'}
          </button>
        </div>
      </footer>

      {/* Confirm before ending / leaving the class */}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmLeave(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isInstructor ? 'End class' : 'Leave class'}
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-neutral-950">
              {isInstructor ? 'End class for everyone?' : 'Leave the class?'}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {isInstructor
                ? 'This ends the live session for all students and returns everyone to the course page. This cannot be undone.'
                : 'You can rejoin while the class is still live.'}
            </p>
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
                  leave();
                }}
                disabled={ending}
                className={cn(
                  btn('primary', 'sm'),
                  'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500 focus-visible:ring-rose-500',
                )}
              >
                {isInstructor ? 'End class' : 'Leave'}
              </button>
            </div>
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
