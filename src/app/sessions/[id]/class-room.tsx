'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getClientToken } from '@/lib/client-token';
import type {
  BuzzerState,
  ChatMessage,
  ClientToServerEvents,
  LeaderboardEntry,
  RoomUser,
  ServerToClientEvents,
} from '@/lib/realtime-contract';
import { BoardPanel } from './board-panel';
import { VideoStage } from './video-stage';

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface BuzzerQuestion {
  id: string;
  body: string;
  timeLimitSec: number;
}

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isInstructor = me.role === 'INSTRUCTOR';
  const myHandRaised = hands.some((h) => h.userId === me.userId);

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

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* ---------- Main column ---------- */}
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm font-medium">
          {(['video', 'board'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 ${
                tab === t
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t === 'video' ? '🎥 Video' : '🧑‍🏫 Chalkboard'}
            </button>
          ))}
        </div>

        {/* Both stay mounted so switching tabs never drops the call or board. */}
        <div className={tab === 'video' ? '' : 'hidden'}>
          <VideoStage sessionId={sessionId} isInstructor={isInstructor} />
        </div>
        <div className={tab === 'board' ? '' : 'hidden'}>
          <BoardPanel sessionId={sessionId} canDraw={isInstructor} />
        </div>

        {picked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            🎤 <strong>{picked.name}</strong> was picked to speak!
          </div>
        )}

        {buzzer?.question &&
          (buzzer.phase === 'QUESTION_OPEN' ||
            buzzer.phase === 'WINNER' ||
            buzzer.phase === 'TIMEOUT') && (
            <div className="rounded-lg border border-indigo-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase text-indigo-500">
                Buzzer round
              </p>
              <p className="mt-1 font-medium">{buzzer.question.body}</p>
              {buzzer.phase === 'QUESTION_OPEN' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:border-indigo-400 disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : buzzer.phase === 'WINNER' ? (
                <p className="mt-3 text-sm text-emerald-700">
                  🏆 {buzzer.winner?.name} answered first and earns the mic!
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  ⏱ Time&apos;s up — nobody got it.
                </p>
              )}
              {answerResult !== null && buzzer.phase === 'QUESTION_OPEN' && (
                <p className="mt-3 text-sm">
                  {answerResult ? '✅ Correct!' : '❌ Not quite.'}
                </p>
              )}
            </div>
          )}

        <div className="flex flex-wrap items-center gap-2">
          {!isInstructor && (
            <button
              onClick={() =>
                socketRef.current?.emit(
                  myHandRaised ? 'hand:lower' : 'hand:raise',
                  { sessionId },
                )
              }
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                myHandRaised
                  ? 'bg-amber-500 text-white hover:bg-amber-400'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
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
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {locked ? '🔓 Unlock chat' : '🔒 Lock chat'}
              </button>
              <button
                onClick={() =>
                  socketRef.current?.emit('student:pick-random', { sessionId })
                }
                disabled={hands.length === 0}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                🎲 Pick a raised hand ({hands.length})
              </button>
            </>
          )}
        </div>

        {isInstructor && questions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-xs font-semibold uppercase text-indigo-500">
              Buzzer
            </span>
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              ⚡ Start round
            </button>
          </div>
        )}

        {notice && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {notice}
          </p>
        )}
      </div>

      {/* ---------- Sidebar ---------- */}
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
              title={connected ? 'Realtime connected' : 'Connecting…'}
            />
            In class ({users.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {users.map((u) => (
              <li key={u.userId}>
                {u.role === 'INSTRUCTOR' ? '🎓' : '👤'} {u.name}
                {hands.some((h) => h.userId === u.userId) && ' ✋'}
              </li>
            ))}
          </ul>
        </section>

        {leaderboard.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Leaderboard</h2>
            <ol className="mt-2 space-y-1 text-sm">
              {leaderboard.slice(0, 10).map((row) => (
                <li key={row.userId} className="flex justify-between">
                  <span>
                    {row.rank}. {row.name}
                    {row.userId === me.userId && ' (you)'}
                  </span>
                  <span className="font-mono text-indigo-600">{row.points}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="flex h-80 flex-col rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            Chat {locked && <span className="ml-1 text-xs text-amber-600">🔒 locked</span>}
          </h2>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2 text-sm">
            {messages.map((m) => (
              <p key={m.id}>
                <span
                  className={
                    m.user.role === 'INSTRUCTOR'
                      ? 'font-semibold text-indigo-700'
                      : 'font-semibold'
                  }
                >
                  {m.user.name}:
                </span>{' '}
                {m.body}
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2 border-t border-slate-100 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(e.currentTarget);
            }}
          >
            <input
              name="body"
              placeholder={
                locked && !isInstructor ? 'Chat is locked' : 'Say something…'
              }
              disabled={locked && !isInstructor}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
            />
            <button
              disabled={locked && !isInstructor}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
