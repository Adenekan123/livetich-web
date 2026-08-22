'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { btn, cn, inputClass, labelClass } from '@/lib/ui';

export interface NewBuzzerQuestion {
  id: string;
  body: string;
  timeLimitSec: number;
}

/** Create a buzzer question on the fly (course-scoped, so it joins the bank).
 *  Used inside the live room — when the instructor hits "Start buzzer" with no
 *  questions yet, this pops so a round can be launched immediately. */
export function BuzzerQuestionModal({
  courseId,
  startOnCreate = false,
  onClose,
  onCreated,
}: {
  courseId: string;
  /** Kick the round off with the new question as soon as it saves. */
  startOnCreate?: boolean;
  onClose: () => void;
  onCreated: (q: NewBuzzerQuestion, start: boolean) => void;
}) {
  const [body, setBody] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [limit, setLimit] = useState(20);
  const [points, setPoints] = useState(25);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (body.trim().length < 3) return setError('Enter a question.');
    if (opts.length < 2) return setError('Add at least two answer options.');
    if (correct >= opts.length)
      return setError('The correct answer must be one of the filled options.');

    setSaving(true);
    setError(null);
    try {
      const token = await getRealtimeToken();
      const res = await fetch(`${API_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          courseId,
          type: 'BUZZER',
          questions: [
            {
              body: body.trim(),
              options: opts,
              correctIndex: correct,
              timeLimitSec: limit,
              points,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const quiz = (await res.json()) as {
        questions?: { id: string; body: string; timeLimitSec: number }[];
      };
      const q = quiz.questions?.[0];
      if (!q) throw new Error('no question returned');
      onCreated(
        { id: q.id, body: q.body, timeLimitSec: q.timeLimitSec },
        startOnCreate,
      );
    } catch {
      setError('Could not save the question. Try again.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New buzzer question"
        className="my-4 w-full max-w-lg rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
            New buzzer question
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="bz-body" className={labelClass}>
              Question
            </label>
            <textarea
              id="bz-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="e.g. What is the ruling of Noon Sakinah before ب?"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Answers — tick the correct one</p>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="correct"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  aria-label={`Mark option ${i + 1} correct`}
                  className="h-4 w-4 shrink-0 accent-signal-600"
                />
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}${i > 1 ? ' (optional)' : ''}`}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="bz-limit" className={labelClass}>
                Time limit
              </label>
              <select
                id="bz-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className={inputClass}
              >
                {[10, 15, 20, 30, 45, 60].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bz-points" className={labelClass}>
                Points for winner
              </label>
              <select
                id="bz-points"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className={inputClass}
              >
                {[5, 10, 15, 25, 50, 100].map((p) => (
                  <option key={p} value={p}>
                    {p} points
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={saving}
              className={cn(btn('primary', 'sm'), saving && 'opacity-60')}
            >
              {saving
                ? 'Saving…'
                : startOnCreate
                  ? 'Save & start round'
                  : 'Save question'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={btn('ghost', 'sm')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
