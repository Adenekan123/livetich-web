'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { PiCaretDown } from 'react-icons/pi';
import {
  createExam,
  deleteExam,
  getExamDetail,
  getExamResults,
  importAlocQuestions,
  updateExam,
} from '@/app/actions/exams';
import { btn, cardClass, cn, inputClass } from '@/lib/ui';
import type {
  ExamDetail,
  ExamListRow,
  ExamQuestionInput,
  ExamResults,
} from '@/lib/types';
import { Rich } from './rich-text';

// ALOC v1 exam types (exact slugs the API expects).
// Only the exam types ALOC actually serves. `neco` and `wassce` 404 on the
// provider, so offering them guaranteed a failed import.
const EXAM_TYPES = [
  { value: 'jamb', label: 'JAMB' },
  { value: 'waec', label: 'WAEC' },
  { value: 'post_utme', label: 'Post-UTME' },
] as const;
// ALOC subject slugs (exact) that the provider actually serves — each verified
// to return questions. `history`, `civic-education` and `insurance` were dropped
// because ALOC 404s them (they made "Import" fail for those subjects).
const SUBJECTS: { value: string; label: string }[] = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'english-language', label: 'English Language' },
  { value: 'literature-in-english', label: 'Literature in English' },
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'economics', label: 'Economics' },
  { value: 'government', label: 'Government' },
  { value: 'geography', label: 'Geography' },
  {
    value: 'christian-religious-studies',
    label: 'Christian Religious Studies',
  },
];

type Draft = ExamQuestionInput;

type ExamSortKey = 'title' | 'questionCount' | 'durationMinutes' | 'submissions' | 'averageScore';

export function ExamManager({
  courseId,
  exams,
}: {
  courseId: string;
  exams: ExamListRow[];
}) {
  const [building, setBuilding] = useState(exams.length === 0);
  const [editing, setEditing] = useState<ExamDetail | null>(null);
  const [sort, setSort] = useState<{ key: ExamSortKey; dir: 'asc' | 'desc' }>({
    key: 'submissions',
    dir: 'desc',
  });
  const inBuilder = building || editing !== null;
  const close = () => {
    setBuilding(false);
    setEditing(null);
  };

  const sortedExams = useMemo(() => {
    const val = (e: ExamListRow): number | string =>
      sort.key === 'title'
        ? e.title.toLowerCase()
        : sort.key === 'averageScore'
          ? e.averageScore ?? -1
          : e[sort.key];
    return [...exams].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [exams, sort]);

  function toggleSort(key: ExamSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'title' ? 'asc' : 'desc' },
    );
  }

  function SortTh({
    label,
    sortKey,
    align = 'right',
  }: {
    label: string;
    sortKey: ExamSortKey;
    align?: 'left' | 'right';
  }) {
    const active = sort.key === sortKey;
    return (
      <th
        className={cn('px-4 py-3', align === 'right' ? 'text-right' : 'text-left')}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={cn(
            'inline-flex items-center gap-1 rounded transition hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500',
            align === 'right' && 'flex-row-reverse',
            active ? 'text-signal-700' : 'text-neutral-400',
          )}
        >
          {label}
          <PiCaretDown className={cn('h-3 w-3', active && sort.dir === 'asc' && 'rotate-180')} />
        </button>
      </th>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Test Prep
        </h1>
        {!inBuilder && (
          <button onClick={() => setBuilding(true)} className={btn('primary', 'sm')}>
            New exam
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Timed mock exams — import real past questions or write your own.
      </p>

      {inBuilder ? (
        <Builder
          key={editing?.id ?? 'new'}
          courseId={courseId}
          existing={editing ?? undefined}
          onDone={close}
          onCancel={exams.length || editing ? close : undefined}
        />
      ) : (
        <>
          <div className={cn(cardClass, 'mt-6 overflow-hidden')}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-wide">
                    <SortTh label="Exam" sortKey="title" align="left" />
                    <SortTh label="Questions" sortKey="questionCount" />
                    <SortTh label="Minutes" sortKey="durationMinutes" />
                    <SortTh label="Submissions" sortKey="submissions" />
                    <SortTh label="Avg score" sortKey="averageScore" />
                    <th className="px-4 py-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedExams.map((e) => (
                    <ExamRow key={e.id} courseId={courseId} exam={e} onEdit={setEditing} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Click a column to sort; open “Results” to see per-student scores and
            topic accuracy.
          </p>
        </>
      )}
    </div>
  );
}

const EXAM_COLS = 6;

function ExamRow({
  courseId,
  exam,
  onEdit,
}: {
  courseId: string;
  exam: ExamListRow;
  onEdit: (detail: ExamDetail) => void;
}) {
  const router = useRouter();
  const [results, setResults] = useState<ExamResults | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loadingEdit, startEdit] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (!results) {
      start(async () => {
        const res = await getExamResults(exam.id);
        if (res.results) setResults(res.results);
      });
    }
  }

  function edit() {
    setError(null);
    startEdit(async () => {
      const res = await getExamDetail(courseId, exam.id);
      if (res.error) setError(res.error);
      else if (res.exam) onEdit(res.exam);
    });
  }

  function del() {
    if (
      !window.confirm(
        `Delete "${exam.title}"? Student scores are kept, but it's removed from the list.`,
      )
    )
      return;
    setError(null);
    startDelete(async () => {
      const res = await deleteExam(courseId, exam.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Fragment>
      <tr className={cn('transition hover:bg-neutral-50', open && 'bg-neutral-50')}>
        <td className="px-4 py-3.5">
          <p className="font-semibold text-neutral-950">{exam.title}</p>
          {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
        </td>
        <td className="px-4 py-3.5 text-right font-mono text-sm text-neutral-800">
          {exam.questionCount}
        </td>
        <td className="px-4 py-3.5 text-right font-mono text-sm text-neutral-800">
          {exam.durationMinutes}
        </td>
        <td className="px-4 py-3.5 text-right font-mono text-sm text-neutral-800">
          {exam.submissions}
        </td>
        <td
          className={cn(
            'px-4 py-3.5 text-right font-mono text-sm',
            exam.averageScore != null ? 'text-neutral-800' : 'text-neutral-400',
          )}
        >
          {exam.averageScore != null ? `${exam.averageScore}%` : '—'}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center justify-end gap-2">
            <button onClick={edit} disabled={loadingEdit} className={btn('ghost', 'sm')}>
              {loadingEdit ? '…' : 'Edit'}
            </button>
            <button onClick={del} disabled={deleting} className={btn('ghost', 'sm')}>
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={toggle} aria-expanded={open} className={btn('secondary', 'sm')}>
              {open ? 'Hide' : 'Results'}
              <PiCaretDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
            </button>
          </div>
        </td>
      </tr>

      {open && (
        <tr className="bg-neutral-50/40">
          <td colSpan={EXAM_COLS} className="px-5 py-4">
            {pending && !results ? (
              <p className="text-sm text-neutral-400">Loading…</p>
            ) : results && results.students.length ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Scores
                  </p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      {results.students.map((s) => (
                        <tr key={s.studentId}>
                          <td className="py-1.5 pr-4 text-neutral-700">{s.name}</td>
                          <td className="py-1.5 text-right font-mono font-semibold text-neutral-900">
                            {s.score == null ? '—' : `${s.score}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    By topic
                  </p>
                  <ul className="space-y-1.5">
                    {results.topics.map((t) => (
                      <li key={t.topic} className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-700">{t.topic}</span>
                          <span className="text-neutral-500">
                            {t.accuracy == null ? '—' : `${t.accuracy}%`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                          <div
                            className="h-1.5 rounded-full bg-signal-600"
                            style={{ width: `${t.accuracy ?? 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No submissions yet.</p>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function Builder({
  courseId,
  existing,
  onDone,
  onCancel,
}: {
  courseId: string;
  existing?: ExamDetail;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [duration, setDuration] = useState(existing?.durationMinutes ?? 30);
  const [questions, setQuestions] = useState<Draft[]>(existing?.questions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Once students have attempted, questions are frozen (past scores stay valid);
  // only the title + time can change.
  const locked = existing?.hasAttempts ?? false;

  // ALOC import controls
  const [subject, setSubject] = useState('mathematics');
  const [examType, setExamType] = useState<string>('jamb');
  const [year, setYear] = useState('');
  const [count, setCount] = useState(20);
  const [importing, startImport] = useTransition();

  function doImport() {
    setError(null);
    setNotice(null);
    startImport(async () => {
      const res = await importAlocQuestions({
        subject,
        examType,
        year: year ? Number(year) : undefined,
        limit: count,
      });
      if (res.error) return setError(res.error);
      const drafts = res.result?.questions ?? [];
      if (!drafts.length) return setError('No questions returned for that selection.');
      setQuestions((prev) => [...prev, ...drafts]);
      setNotice(
        `Imported ${drafts.length} question${drafts.length === 1 ? '' : 's'}` +
          (res.result?.fromCache
            ? ' from the shared pool (no credit used).'
            : res.result?.creditsRemaining != null
              ? ` · ${res.result.creditsRemaining} ALOC credits left.`
              : '.'),
      );
    });
  }

  function addBlank() {
    setQuestions((prev) => [
      ...prev,
      { body: '', options: ['', ''], correctIndex: 0, topic: '' },
    ]);
  }

  function update(i: number, patch: Partial<Draft>) {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }
  function remove(i: number) {
    setQuestions((prev) => prev.filter((_, j) => j !== i));
  }

  function save() {
    setError(null);
    if (!title.trim()) return setError('Give the exam a title.');
    let clean: Draft[] = [];
    if (!locked) {
      clean = questions.filter(
        (q) => q.body.trim() && q.options.filter((o) => o.trim()).length >= 2,
      );
      if (!clean.length) return setError('Add at least one complete question.');
    }
    start(async () => {
      const meta = { title: title.trim(), durationMinutes: duration };
      const res = existing
        ? await updateExam(
            courseId,
            existing.id,
            locked ? meta : { ...meta, questions: clean },
          )
        : await createExam(courseId, { ...meta, questions: clean });
      if (res.error) return setError(res.error);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Exam meta */}
      <div className={cn(cardClass, 'p-5')}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JAMB Mock — Mathematics"
              className={cn(inputClass, 'mt-1')}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Minutes</span>
            <input
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={cn(inputClass, 'mt-1 w-28')}
            />
          </label>
        </div>
      </div>

      {locked && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Students have attempted this exam, so the questions are locked (past
          scores stay valid). You can still change the title and time limit.
        </p>
      )}

      {!locked && (
        <>
      {/* ALOC import */}
      <div className={cn(cardClass, 'p-5')}>
        <p className="text-sm font-semibold text-neutral-900">Import past questions</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          Real JAMB/WAEC/NECO/Post-UTME questions from ALOC. Review before saving.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Subject</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={cn(inputClass, 'mt-1 w-44')}
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Exam</span>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className={cn(inputClass, 'mt-1 w-32')}
            >
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Year</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="any"
              className={cn(inputClass, 'mt-1 w-20')}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">Count</span>
            <input
              type="number"
              min={1}
              max={40}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={cn(inputClass, 'mt-1 w-20')}
            />
          </label>
          <button
            onClick={doImport}
            disabled={importing}
            className={btn('secondary', 'md')}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
        {notice && <p className="mt-3 text-xs font-medium text-emerald-700">{notice}</p>}
      </div>

      {/* Questions */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">
            Questions ({questions.length})
          </p>
          <button onClick={addBlank} className={btn('ghost', 'sm')}>
            + Add manually
          </button>
        </div>
        <ol className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className={cn(cardClass, 'p-4')}>
              <div className="flex items-start gap-2">
                <span className="mt-2 text-xs font-semibold text-neutral-400">{i + 1}</span>
                <textarea
                  value={q.body}
                  onChange={(e) => update(i, { body: e.target.value })}
                  rows={2}
                  placeholder="Question text"
                  className={cn(inputClass, 'flex-1 resize-y')}
                />
                <button
                  onClick={() => remove(i)}
                  className="mt-1 text-xs font-medium text-neutral-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 space-y-1.5 pl-6">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correctIndex === oi}
                      onChange={() => update(i, { correctIndex: oi })}
                      className="h-4 w-4 text-neutral-900"
                      title="Mark correct"
                    />
                    <input
                      value={opt}
                      onChange={(e) =>
                        update(i, {
                          options: q.options.map((o, j) => (j === oi ? e.target.value : o)),
                        })
                      }
                      placeholder={`Option ${oi + 1}`}
                      className={cn(inputClass, 'flex-1 py-1.5 text-sm')}
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() =>
                          update(i, { options: q.options.filter((_, j) => j !== oi) })
                        }
                        className="text-xs text-neutral-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </label>
                ))}
                <button
                  onClick={() => update(i, { options: [...q.options, ''] })}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  + option
                </button>
              </div>
              {/* Rendered preview — sup/sub etc. show as they will to students,
                  so imported markup isn't just raw text in the editor. */}
              {/<[a-z]/i.test(q.body + q.options.join('')) && (
                <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 pl-6 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-400">Preview: </span>
                  <Rich text={q.body} />
                  {q.options.some((o) => o.trim()) && (
                    <span> — {q.options.filter(Boolean).map((o, k) => (
                      <span key={k}>
                        {k > 0 && ' · '}
                        <Rich text={o} />
                      </span>
                    ))}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={pending} className={btn('primary', 'md')}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Save exam'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className={btn('ghost', 'md')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
