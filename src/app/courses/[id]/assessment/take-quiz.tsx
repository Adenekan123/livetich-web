'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitAssessment } from '@/app/actions/assessment';
import { btn, cardClass, cn } from '@/lib/ui';
import type { AssessmentResult, AssessmentTake } from '@/lib/types';

export function TakeQuiz({
  courseId,
  assessmentId,
  take,
}: {
  courseId: string;
  assessmentId: string;
  take: AssessmentTake;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const heading = take.topic ?? 'Class quiz';

  // --- Already graded (revisit): show the answer key + what they picked. ---
  if (take.submitted) {
    return (
      <div className="mt-4">
        <Header topic={heading} />
        <p className="mt-1 text-sm text-neutral-500">
          You scored{' '}
          <span className="font-semibold text-neutral-900">
            {take.score}/{take.total}
          </span>
          .
        </p>
        <ol className="mt-6 space-y-4">
          {take.questions.map((q, qi) => (
            <li key={q.id} className={cn(cardClass, 'p-5')}>
              <p className="font-medium text-neutral-900">
                {qi + 1}. {q.body}
              </p>
              <ul className="mt-3 space-y-2">
                {q.options.map((opt, i) => {
                  const isCorrect = i === q.correctIndex;
                  const isMine = i === q.myAnswerIndex;
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
                      <span className="flex-1">{opt}</span>
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
        <Link
          href={`/courses/${courseId}/assessment`}
          className={cn(btn('secondary', 'md'), 'mt-6')}
        >
          Back to assessments
        </Link>
      </div>
    );
  }

  // --- Just submitted: result summary + any assigned remediation. ---
  if (result) {
    return (
      <div className="mt-4">
        <Header topic={heading} />
        <div className={cn(cardClass, 'mt-4 p-6 text-center')}>
          <p className="text-sm font-medium text-neutral-500">Your score</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-neutral-950">
            {result.score}/{result.total}
          </p>
        </div>
        {result.assignedRemediation.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              Some practice has been added to help you catch up:
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
              {result.assignedRemediation.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">
            Great work — no extra practice needed. 🎉
          </p>
        )}
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            className={btn('secondary', 'md')}
          >
            Review answers
          </button>
          <Link
            href={`/courses/${courseId}/assessment`}
            className={btn('ghost', 'md')}
          >
            Back to assessments
          </Link>
        </div>
      </div>
    );
  }

  // --- Taking the quiz. ---
  const allAnswered = take.questions.every((q) => answers[q.id] !== undefined);

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitAssessment(
        courseId,
        assessmentId,
        take.questions.map((q) => ({
          questionId: q.id,
          answerIndex: answers[q.id],
        })),
      );
      if (res.error) setError(res.error);
      else if (res.result) setResult(res.result);
    });
  }

  return (
    <div className="mt-4">
      <Header topic={heading} />
      <p className="mt-1 text-sm text-neutral-500">
        {take.questions.length} question{take.questions.length === 1 ? '' : 's'} ·
        answer all to submit.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {take.questions.map((q, qi) => (
          <li key={q.id} className={cn(cardClass, 'p-5')}>
            <p className="font-medium text-neutral-900">
              {qi + 1}. {q.body}
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
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: i }))
                        }
                        className="h-4 w-4 text-neutral-900 focus:ring-neutral-400"
                      />
                      {opt}
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <button
          onClick={submit}
          disabled={pending || !allAnswered}
          className={btn('primary', 'md')}
        >
          {pending ? 'Submitting…' : 'Submit answers'}
        </button>
        {!allAnswered && (
          <p className="mt-2 text-xs text-neutral-400">
            Answer every question to submit.
          </p>
        )}
      </div>
    </div>
  );
}

function Header({ topic }: { topic: string }) {
  return (
    <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
      {topic}
    </h1>
  );
}
