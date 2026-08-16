'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startExam, submitExam } from '@/app/actions/exams';
import { btn, cardClass, cn, inputClass } from '@/lib/ui';
import type { ExamAvailableRow, ExamStart, ExamSubmitResult } from '@/lib/types';

/** ALOC question text embeds <sup>/<sub> (and the odd <br>) HTML. Render just
 *  that whitelist safely: escape everything, then re-enable those tags — so
 *  "(343)<sup>1/3</sup>" shows as proper math, never as literal markup, and no
 *  other markup (scripts, attributes) can slip through. */
function richHtml(s: string): string {
  const esc = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/&lt;(\/?)(sup|sub)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>');
}

function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: richHtml(text) }} />
  );
}

export function ExamTaker({
  courseId,
  exams,
}: {
  courseId: string;
  exams: ExamAvailableRow[];
}) {
  const [take, setTake] = useState<ExamStart | null>(null);
  const [result, setResult] = useState<ExamSubmitResult | null>(null);

  if (take) {
    return (
      <Sitting
        take={take}
        onDone={(r) => {
          setResult(r);
          setTake(null);
        }}
      />
    );
  }

  return (
    <div className="mt-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
        Test Prep
      </h1>
      <p className="mt-1 text-sm text-neutral-500">Timed practice exams.</p>

      {result && (
        <div className={cn(cardClass, 'mt-4 p-6 text-center')}>
          <p className="text-sm font-medium text-neutral-500">Your score</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-neutral-950">
            {result.score}%
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {result.correct} of {result.total} correct
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {exams.length === 0 && (
          <li className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
            No exams available yet.
          </li>
        )}
        {exams.map((e) => (
          <ExamCard key={e.id} exam={e} onStart={setTake} />
        ))}
      </ul>
    </div>
  );
}

function ExamCard({
  exam,
  onStart,
}: {
  exam: ExamAvailableRow;
  onStart: (t: ExamStart) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = exam.myAttempt?.submitted;

  function begin() {
    setError(null);
    start(async () => {
      const res = await startExam(exam.id);
      if (res.error) setError(res.error);
      else if (res.take) onStart(res.take);
    });
  }

  return (
    <li className={cn(cardClass, 'flex flex-wrap items-center justify-between gap-3 p-5')}>
      <div>
        <h3 className="font-semibold text-neutral-950">{exam.title}</h3>
        <p className="mt-0.5 text-xs text-neutral-400">
          {exam.questionCount} questions · {exam.durationMinutes} min
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {done ? (
        <span className="text-sm font-semibold text-emerald-700">
          Scored {exam.myAttempt!.score}%
        </span>
      ) : (
        <button onClick={begin} disabled={pending} className={btn('primary', 'sm')}>
          {pending ? 'Starting…' : 'Start'}
        </button>
      )}
    </li>
  );
}

function Sitting({
  take,
  onDone,
}: {
  take: ExamStart;
  onDone: (r: ExamSubmitResult) => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(take.deadline).getTime() - Date.now()) / 1000)),
  );
  const submittedRef = useRef(false);

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    start(async () => {
      const res = await submitExam(
        take.attemptId,
        Object.entries(answers).map(([questionId, chosenIndex]) => ({
          questionId,
          chosenIndex,
        })),
      );
      if (res.error) {
        submittedRef.current = false;
        setError(res.error);
      } else if (res.result) {
        router.refresh();
        onDone(res.result);
      }
    });
  }, [answers, take.attemptId, router, onDone]);

  // Countdown; auto-submit when the clock hits zero.
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((new Date(take.deadline).getTime() - Date.now()) / 1000),
      );
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        submit();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [take.deadline, submit]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const answered = Object.keys(answers).length;

  return (
    <div className="mt-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div>
          <h1 className="font-display text-lg font-extrabold text-neutral-950">
            {take.title}
          </h1>
          <p className="text-xs text-neutral-400">
            {answered}/{take.questions.length} answered
          </p>
        </div>
        <span
          className={cn(
            'font-mono text-lg font-bold tabular-nums',
            remaining <= 60 ? 'text-red-600' : 'text-neutral-900',
          )}
        >
          {mm}:{ss}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {take.questions.map((q, qi) => (
          <li key={q.id} className={cn(cardClass, 'p-5')}>
            <p className="font-medium text-neutral-900">
              {qi + 1}. <Rich text={q.body} />
            </p>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt, i) => {
                const checked = answers[q.id] === i;
                return (
                  <li key={i}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition',
                        checked
                          ? 'border-neutral-900 bg-neutral-50 font-medium text-neutral-900'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-300',
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={checked}
                        onChange={() => setAnswers((p) => ({ ...p, [q.id]: i }))}
                        className="h-4 w-4 text-neutral-900 focus:ring-neutral-400"
                      />
                      <Rich text={opt} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <button onClick={submit} disabled={pending} className={btn('primary', 'md')}>
          {pending ? 'Submitting…' : 'Submit exam'}
        </button>
      </div>
    </div>
  );
}
