'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getClientToken } from '@/lib/client-token';
import { avatarColor, btn, cardClass, cn, initials } from '@/lib/ui';
import type {
  BuzzerState,
  ChatMessage,
  ClientToServerEvents,
  LeaderboardEntry,
  RoomUser,
  ServerToClientEvents,
} from '@/lib/realtime-contract';
import dynamic from 'next/dynamic';
import { VideoStage } from './video-stage';

// tldraw touches browser-only APIs, so it must not render on the server.
const BoardTldraw = dynamic(
  () => import('./board-tldraw').then((m) => m.BoardTldraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
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

const MEDALS = ['🥇', '🥈', '🥉'];

export function ClassRoom({
  sessionId,
  me,
}: {
  sessionId: string;
  me: RoomUser;
}) {
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
  const [tab, setTab] = useState<'video' | 'board'>('video');
  const [questions, setQuestions] = useState<BuzzerQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [screenGrants, setScreenGrants] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isInstructor = me.role === 'INSTRUCTOR';
  const myHandRaised = hands.some((h) => h.userId === me.userId);
  const iMayScreenShare = isInstructor || screenGrants.has(me.userId);

  useEffect(() => {
    const socket: RoomSocket = io(API_URL, {
      auth: { token: getClientToken() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:presence', (p) => setUsers(p.users));
    socket.on('chat:history', (p) => setMessages(p.messages));
    socket.on('chat:message', (m) => setMessages((prev) => [...prev, m]));
    socket.on('chat:locked', (p) => setLocked(p.locked));
    socket.on('hands:update', (p) => setHands(p.raised));
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
    socket.on('screen-share:granted', (p) =>
      setScreenGrants((prev) => new Set(prev).add(p.userId)),
    );
    socket.on('screen-share:revoked', (p) =>
      setScreenGrants((prev) => {
        const next = new Set(prev);
        next.delete(p.userId);
        return next;
      }),
    );
    socket.on('error', (e) => {
      setNotice(e.message);
      setTimeout(() => setNotice(null), 4000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Buzzer questions for this session (instructor-only endpoint).
  useEffect(() => {
    if (!isInstructor) return;
    fetch(`${API_URL}/quizzes?sessionId=${sessionId}`, {
      headers: { Authorization: `Bearer ${getClientToken() ?? ''}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (quizzes: { questions: { id: string; body: string; timeLimitSec: number }[] }[]) => {
          const qs = quizzes.flatMap((q) => q.questions);
          setQuestions(qs);
          if (qs.length > 0) setSelectedQuestion(qs[0].id);
        },
      )
      .catch(() => setQuestions([]));
  }, [isInstructor, sessionId]);

  const send = (form: HTMLFormElement) => {
    const input = form.elements.namedItem('body') as HTMLInputElement;
    const body = input.value.trim();
    if (!body) return;
    socketRef.current?.emit('chat:send', { sessionId, body });
    input.value = '';
  };

  const chatLockedForMe = locked && !isInstructor;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* ---------- Main column ---------- */}
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-sm font-medium">
          {(['video', 'board'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-4 py-1.5 transition',
                tab === t
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {t === 'video' ? '🎥 Video' : '🧑‍🏫 Chalkboard'}
            </button>
          ))}
        </div>

        {/* Both stay mounted so switching tabs never drops the call or board. */}
        <div className={tab === 'video' ? '' : 'hidden'}>
          <VideoStage
            sessionId={sessionId}
            isInstructor={isInstructor}
            canScreenShare={iMayScreenShare}
          />
        </div>
        <div className={tab === 'board' ? '' : 'hidden'}>
          <BoardTldraw sessionId={sessionId} canDraw={isInstructor} />
        </div>

        {picked && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="text-lg leading-none">🎤</span>
            <span>
              <strong className="font-semibold">{picked.name}</strong> was picked
              to speak!
            </span>
          </div>
        )}

        {buzzer?.question &&
          (buzzer.phase === 'QUESTION_OPEN' ||
            buzzer.phase === 'WINNER' ||
            buzzer.phase === 'TIMEOUT') && (
            <div className={cn(cardClass, 'overflow-hidden')}>
              <div className="flex items-center gap-2 border-b border-slate-100 bg-indigo-50 px-5 py-2.5">
                <span className="text-sm font-semibold text-indigo-700">
                  ⚡ Buzzer round
                </span>
              </div>
              <div className="p-5">
                <p className="font-medium text-slate-900">{buzzer.question.body}</p>
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
                        className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-indigo-400 disabled:opacity-50 disabled:hover:border-slate-300"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : buzzer.phase === 'WINNER' ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    🏆 {buzzer.winner?.name} answered first and earns the mic!
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    ⏱ Time&apos;s up — nobody got it.
                  </div>
                )}
                {answerResult !== null && buzzer.phase === 'QUESTION_OPEN' && (
                  <p
                    className={cn(
                      'mt-3 text-sm font-medium',
                      answerResult ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {answerResult ? '✅ Correct!' : '❌ Not quite.'}
                  </p>
                )}
              </div>
            </div>
          )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!isInstructor && (
            <button
              onClick={() =>
                socketRef.current?.emit(
                  myHandRaised ? 'hand:lower' : 'hand:raise',
                  { sessionId },
                )
              }
              className={
                myHandRaised
                  ? btn(
                      'primary',
                      'md',
                      'bg-amber-500 shadow-amber-500/20 hover:bg-amber-400 focus-visible:ring-amber-500',
                    )
                  : btn('secondary')
              }
            >
              {myHandRaised ? '✋ Lower hand' : '✋ Raise hand'}
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
                className={btn('secondary')}
              >
                {locked ? '🔓 Unlock chat' : '🔒 Lock chat'}
              </button>
              <button
                onClick={() =>
                  socketRef.current?.emit('student:pick-random', { sessionId })
                }
                disabled={hands.length === 0}
                className={btn('secondary')}
              >
                🎲 Pick a raised hand ({hands.length})
              </button>
            </>
          )}
        </div>

        {isInstructor && questions.length > 0 && (
          <div className={cn(cardClass, 'flex flex-wrap items-center gap-2 p-3')}>
            <span className="text-sm font-semibold text-indigo-600">⚡ Buzzer</span>
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            >
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
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
              disabled={hands.length === 0 || buzzer?.phase === 'QUESTION_OPEN'}
              title={hands.length === 0 ? 'Needs raised hands' : undefined}
              className={btn('primary', 'sm')}
            >
              Start round
            </button>
          </div>
        )}
      </div>

      {/* ---------- Sidebar ---------- */}
      <div className="space-y-4">
        {/* Participants */}
        <section className={cn(cardClass, 'p-4')}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                connected ? 'animate-live bg-emerald-500' : 'bg-slate-300',
              )}
              title={connected ? 'Realtime connected' : 'Connecting…'}
            />
            In class
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {users.length}
            </span>
          </h2>
          <ul className="mt-3 space-y-1.5">
            {users.map((u) => {
              const granted = screenGrants.has(u.userId);
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
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {u.name}
                    {u.role === 'INSTRUCTOR' && (
                      <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-600">
                        host
                      </span>
                    )}
                  </span>
                  {handUp && <span title="Hand raised">✋</span>}
                  {granted && <span title="Can screen-share">🖥</span>}
                  {isInstructor && u.role === 'STUDENT' && (
                    <button
                      onClick={() =>
                        socketRef.current?.emit(
                          granted ? 'screen-share:revoke' : 'screen-share:grant',
                          { sessionId, userId: u.userId },
                        )
                      }
                      className="rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      {granted ? 'Revoke' : 'Allow share'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section className={cn(cardClass, 'p-4')}>
            <h2 className="text-sm font-semibold text-slate-900">Leaderboard</h2>
            <ol className="mt-2 space-y-0.5">
              {leaderboard.slice(0, 10).map((row) => {
                const isMe = row.userId === me.userId;
                return (
                  <li
                    key={row.userId}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-2 py-1.5',
                      isMe && 'bg-indigo-50',
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
                            ? 'font-semibold text-indigo-700'
                            : 'text-slate-700',
                        )}
                      >
                        {row.name}
                        {isMe && ' (you)'}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {row.points}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Chat */}
        <section className={cn(cardClass, 'flex h-96 flex-col')}>
          <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
            Chat
            {locked && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                🔒 locked
              </span>
            )}
          </h2>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No messages yet — say hello 👋
              </p>
            )}
            {messages.map((m) => (
              <p key={m.id} className="leading-relaxed">
                <span
                  className={cn(
                    'font-semibold',
                    m.user.role === 'INSTRUCTOR'
                      ? 'text-indigo-600'
                      : 'text-slate-900',
                  )}
                >
                  {m.user.name}
                </span>
                <span className="text-slate-600"> {m.body}</span>
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2 border-t border-slate-100 p-2.5"
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
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              disabled={chatLockedForMe}
              className={btn('primary', 'sm')}
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {/* Transient error toast */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
