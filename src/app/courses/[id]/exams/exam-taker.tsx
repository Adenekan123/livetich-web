'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getExamReview, startExam, submitExam } from '@/app/actions/exams';
import { btn, cardClass, cn, inputClass } from '@/lib/ui';
import type {
  ExamAvailableRow,
  ExamReview,
  ExamStart,
  ExamSubmitResult,
} from '@/lib/types';
import { Rich } from './rich-text';

export function ExamTaker({
  courseId,
  exams,
}: {
  courseId: string;
  exams: ExamAvailableRow[];
}) {
  const [take, setTake] = useState<ExamStart | null>(null);
  const [result, setResult] = useState<{ r: ExamSubmitResult; examId: string } | null>(
    null,
  );
  const [review, setReview] = useState<ExamReview | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [loadingReview, startReview] = useTransition();

  const openReview = useCallback(
    (examId: string) => {
      setReviewErr(null);
      startReview(async () => {
        const res = await getExamReview(examId);
        if (res.error) setReviewErr(res.error);
        else if (res.review) setReview(res.review);
      });
    },
    [],
  );

  if (take) {
    return (
      <Sitting
        take={take}
        onDone={(r, examId) => {
          setResult({ r, examId });
          setTake(null);
        }}
      />
    );
  }

  if (review) {
    return <ReviewView review={review} onBack={() => setReview(null)} />;
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
            {result.r.score}%
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {result.r.expired
              ? 'Time expired — not submitted in time'
              : `${result.r.correct} of ${result.r.total} correct`}
          </p>
          <button
            onClick={() => openReview(result.examId)}
            disabled={loadingReview}
            className={cn(btn('secondary', 'sm'), 'mt-4')}
          >
            {loadingReview ? 'Loading…' : 'Review answers'}
          </button>
        </div>
      )}
      {reviewErr && <p className="mt-3 text-sm text-red-600">{reviewErr}</p>}

      <ul className="mt-6 space-y-3">
        {exams.length === 0 && (
          <li className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
            No exams available yet.
          </li>
        )}
        {exams.map((e) => (
          <ExamCard
            key={e.id}
            exam={e}
            onStart={setTake}
            onReview={() => openReview(e.id)}
            reviewing={loadingReview}
          />
        ))}
      </ul>
    </div>
  );
}

function ExamCard({
  exam,
  onStart,
  onReview,
  reviewing,
}: {
  exam: ExamAvailableRow;
  onStart: (t: ExamStart) => void;
  onReview: () => void;
  reviewing: boolean;
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
          {done && ` · last scored ${exam.myAttempt!.score}%`}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {done ? (
        <div className="flex items-center gap-2">
          <button onClick={onReview} disabled={reviewing} className={btn('ghost', 'sm')}>
            Review
          </button>
          <button onClick={begin} disabled={pending} className={btn('secondary', 'sm')}>
            {pending ? 'Starting…' : 'Retake'}
          </button>
        </div>
      ) : (
        <button onClick={begin} disabled={pending} className={btn('primary', 'sm')}>
          {pending ? 'Starting…' : 'Start'}
        </button>
      )}
    </li>
  );
}

/** Post-exam answer key: correct option in green, a wrong pick in red. */
function ReviewView({
  review,
  onBack,
}: {
  review: ExamReview;
  onBack: () => void;
}) {
  return (
    <div className="mt-4">
      <button onClick={onBack} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
        ← Back to exams
      </button>
      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-neutral-950">
        {review.examTitle}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        You scored{' '}
        <span className="font-semibold text-neutral-900">{review.score}%</span> ·{' '}
        {review.total} questions.
      </p>

      <ol className="mt-6 space-y-4">
        {review.questions.map((q, qi) => (
          <li key={q.id} className={cn(cardClass, 'p-5')}>
            <p className="font-medium text-neutral-900">
              {qi + 1}. <Rich text={q.body} />
            </p>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correctIndex;
                const isMine = i === q.chosenIndex;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                      isCorrect
                        ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-800'
                        : isMine
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-neutral-200 text-neutral-600',
                    )}
                  >
                    <Rich text={opt} className="flex-1" />
                    {isCorrect && <span className="text-xs font-semibold">Correct</span>}
                    {isMine && !isCorrect && (
                      <span className="text-xs font-semibold">Your answer</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Sitting({
  take,
  onDone,
}: {
  take: ExamStart;
  onDone: (r: ExamSubmitResult, examId: string) => void;
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
        onDone(res.result, take.examId);
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
