'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { btn, cardClass, cn } from '@/lib/ui';
import { BuzzerQuestionModal } from '@/app/sessions/[id]/buzzer-question-modal';

export interface BuzzerQuiz {
  id: string;
  questions: {
    id: string;
    body: string;
    options: string[];
    correctIndex: number;
    timeLimitSec: number;
    points?: number;
  }[];
}

/** Manage a course's reusable buzzer question bank — add (via the shared modal),
 *  list, and delete. Course-scoped, so questions exist before any live session. */
export function BuzzerBank({
  courseId,
  quizzes,
}: {
  courseId: string;
  quizzes: BuzzerQuiz[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const questions = quizzes.flatMap((q) => q.questions);

  async function remove(questionId: string) {
    setDeleting(questionId);
    try {
      const token = await getRealtimeToken();
      await fetch(`${API_URL}/quizzes/questions/${questionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mt-6">
      <button onClick={() => setAdding(true)} className={btn('primary', 'sm')}>
        + Add question
      </button>

      {questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-8 text-center text-sm text-neutral-500">
          No buzzer questions yet. Add your first — it&apos;ll be ready to launch
          in any live class.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className={cn(cardClass, 'p-4')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{q.body}</p>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o, i) => (
                      <li
                        key={i}
                        className={cn(
                          'text-sm',
                          i === q.correctIndex
                            ? 'font-semibold text-signal-700'
                            : 'text-neutral-500',
                        )}
                      >
                        {String.fromCharCode(65 + i)}. {o}
                        {i === q.correctIndex && ' ✓'}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-neutral-400">
                    {q.timeLimitSec}s per round · {q.points ?? 25} pts to winner
                  </p>
                </div>
                <button
                  onClick={() => remove(q.id)}
                  disabled={deleting === q.id}
                  className={cn(
                    btn('ghost', 'sm'),
                    'shrink-0 text-rose-600 hover:bg-rose-50',
                  )}
                >
                  {deleting === q.id ? 'Removing…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <BuzzerQuestionModal
          courseId={courseId}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
