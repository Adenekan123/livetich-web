'use client';

import { useMemo, useState, useTransition } from 'react';
import { PiPlus, PiTrash, PiX } from 'react-icons/pi';
import {
  createQuestion,
  createTask,
  deleteQuestion,
  deleteTask,
} from '@/app/actions/assessment';
import { btn, cardClass, cn, inputClass, labelClass } from '@/lib/ui';
import type {
  AssessmentQuestion,
  CourseDocument,
  RemediationTask,
  Section,
} from '@/lib/types';
import { AiDrafting } from './ai-drafting';

type Tab = 'questions' | 'tasks' | 'ai';

export function AuthoringPanel({
  courseId,
  sections,
  questions,
  tasks,
  documents,
}: {
  courseId: string;
  sections: Section[];
  questions: AssessmentQuestion[];
  tasks: RemediationTask[];
  documents: CourseDocument[];
}) {
  const [tab, setTab] = useState<Tab>('questions');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections],
  );

  if (sections.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
        Add curriculum sections to this program first — questions and tasks are
        organised by topic (section).
      </p>
    );
  }

  return (
    <section className="mt-6">
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 text-sm font-semibold">
        {(['questions', 'tasks', 'ai'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-1.5 transition',
              tab === t
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800',
            )}
          >
            {t === 'questions'
              ? `Questions (${questions.length})`
              : t === 'tasks'
                ? `Remediation tasks (${tasks.length})`
                : '✨ Draft with AI'}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <QuestionBank
          courseId={courseId}
          sections={sections}
          questions={questions}
          sectionById={sectionById}
          pending={pending}
          act={act}
        />
      )}
      {tab === 'tasks' && (
        <TaskBank
          courseId={courseId}
          sections={sections}
          tasks={tasks}
          sectionById={sectionById}
          pending={pending}
          act={act}
        />
      )}
      {tab === 'ai' && (
        <AiDrafting
          courseId={courseId}
          sections={sections}
          documents={documents}
        />
      )}
    </section>
  );
}

/* ----------------------------- Question bank ----------------------------- */

function QuestionBank({
  courseId,
  sections,
  questions,
  sectionById,
  pending,
  act,
}: {
  courseId: string;
  sections: Section[];
  questions: AssessmentQuestion[];
  sectionById: Map<string, Section>;
  pending: boolean;
  act: (fn: () => Promise<{ error: string | null }>) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Question bank</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className={btn('primary', 'sm')}>
            <PiPlus className="h-4 w-4" /> Add question
          </button>
        )}
      </div>

      {adding && (
        <QuestionForm
          sections={sections}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            act(async () => {
              const res = await createQuestion(courseId, input);
              if (!res.error) setAdding(false);
              return res;
            })
          }
        />
      )}

      {questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          No questions yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className={cn(cardClass, 'p-4')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                    {sectionById.get(q.sectionId)?.title ?? 'Topic'}
                  </span>
                  <p className="mt-1.5 font-medium text-neutral-900">{q.body}</p>
                </div>
                <button
                  onClick={() => act(() => deleteQuestion(courseId, q.id))}
                  disabled={pending}
                  aria-label="Delete question"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {q.options.map((opt, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      i === q.correctIndex
                        ? 'font-semibold text-emerald-700'
                        : 'text-neutral-600',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-4 w-4 place-items-center rounded-full border text-[10px]',
                        i === q.correctIndex
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-neutral-300 text-transparent',
                      )}
                    >
                      ✓
                    </span>
                    {opt}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionForm({
  sections,
  pending,
  onCancel,
  onSubmit,
}: {
  sections: Section[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    sectionId: string;
    body: string;
    options: string[];
    correctIndex: number;
  }) => void;
}) {
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    if (options.length < 6) setOptions((prev) => [...prev, '']);
  }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setCorrectIndex((c) => (c === i ? 0 : c > i ? c - 1 : c));
  }

  const cleaned = options.map((o) => o.trim());
  const valid =
    sectionId &&
    body.trim().length >= 2 &&
    cleaned.filter(Boolean).length >= 2 &&
    cleaned[correctIndex];

  return (
    <div className={cn(cardClass, 'mt-4 p-5')}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Topic (section)</label>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={inputClass}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.order}. {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Question</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="What is…?"
            className={cn(inputClass, 'resize-none')}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>
            Options{' '}
            <span className="font-normal text-neutral-400">
              — select the correct one
            </span>
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-400"
                  aria-label={`Mark option ${i + 1} correct`}
                />
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className={cn(inputClass, 'flex-1 py-1.5')}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    aria-label="Remove option"
                    className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              onClick={addOption}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
            >
              + Add option
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() =>
              onSubmit({
                sectionId,
                body: body.trim(),
                options: cleaned.filter(Boolean),
                // correctIndex must point at a non-empty option post-filter.
                correctIndex: cleaned
                  .filter(Boolean)
                  .indexOf(cleaned[correctIndex]),
              })
            }
            disabled={pending || !valid}
            className={btn('primary', 'sm')}
          >
            Save question
          </button>
          <button onClick={onCancel} className={btn('ghost', 'sm')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Remediation tasks --------------------------- */

function TaskBank({
  courseId,
  sections,
  tasks,
  sectionById,
  pending,
  act,
}: {
  courseId: string;
  sections: Section[];
  tasks: RemediationTask[];
  sectionById: Map<string, Section>;
  pending: boolean;
  act: (fn: () => Promise<{ error: string | null }>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');

  function reset() {
    setTitle('');
    setInstructions('');
    setAdding(false);
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">
          Remediation tasks
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className={btn('primary', 'sm')}>
            <PiPlus className="h-4 w-4" /> Add task
          </button>
        )}
      </div>

      {adding && (
        <div className={cn(cardClass, 'mt-4 p-5')}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Topic (section)</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className={inputClass}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.order}. {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Task title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Re-read section 2 and redo the exercises"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>
                Instructions{' '}
                <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className={cn(inputClass, 'resize-none')}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() =>
                  act(async () => {
                    const res = await createTask(courseId, {
                      sectionId,
                      title: title.trim(),
                      instructions: instructions.trim() || undefined,
                    });
                    if (!res.error) reset();
                    return res;
                  })
                }
                disabled={pending || !sectionId || title.trim().length < 2}
                className={btn('primary', 'sm')}
              >
                Save task
              </button>
              <button onClick={reset} className={btn('ghost', 'sm')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          No remediation tasks yet. Add one per topic so a missed topic has
          something to assign.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={cn(cardClass, 'flex items-start justify-between gap-3 p-4')}
            >
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                  {sectionById.get(t.sectionId)?.title ?? 'Topic'}
                </span>
                <p className="mt-1.5 font-medium text-neutral-900">{t.title}</p>
                {t.instructions && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-600">
                    {t.instructions}
                  </p>
                )}
              </div>
              <button
                onClick={() => act(() => deleteTask(courseId, t.id))}
                disabled={pending}
                aria-label="Delete task"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <PiTrash className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
