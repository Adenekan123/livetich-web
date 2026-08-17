'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiFilePdf, PiMagicWand, PiTrash } from 'react-icons/pi';
import {
  acceptDrafts,
  deleteDocument,
  draftFromDocument,
  uploadDocument,
} from '@/app/actions/assessment-ai';
import { btn, cardClass, cn, inputClass, labelClass } from '@/lib/ui';
import type { CourseDocument, DraftResult, Section } from '@/lib/types';

export function AiDrafting({
  courseId,
  sections,
  documents,
}: {
  courseId: string;
  sections: Section[];
  documents: CourseDocument[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [documentId, setDocumentId] = useState(documents[0]?.id ?? '');
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [count, setCount] = useState(5);

  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [qSel, setQSel] = useState<Set<number>>(new Set());
  const [tSel, setTSel] = useState<Set<number>>(new Set());

  function run(fn: () => Promise<{ error: string | null }>, ok?: string) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        if (ok) setNotice(ok);
        router.refresh();
      }
    });
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a PDF or Word (.docx) file');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    run(async () => {
      const res = await uploadDocument(courseId, fd);
      if (!res.error) {
        if (fileRef.current) fileRef.current.value = '';
        if (res.doc) setDocumentId(res.doc.id);
      }
      return res;
    }, 'Document uploaded.');
  }

  function generate() {
    if (!documentId || !sectionId) return;
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await draftFromDocument(courseId, {
        documentId,
        sectionId,
        count,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      const r = res.result!;
      setDraft(r);
      setQSel(new Set(r.questions.map((_, i) => i)));
      setTSel(new Set(r.tasks.map((_, i) => i)));
    });
  }

  function accept() {
    if (!draft) return;
    const questions = draft.questions.filter((_, i) => qSel.has(i));
    const tasks = draft.tasks.filter((_, i) => tSel.has(i));
    if (questions.length === 0 && tasks.length === 0) {
      setError('Select at least one item to add.');
      return;
    }
    run(async () => {
      const res = await acceptDrafts(
        courseId,
        draft.sectionId,
        questions,
        tasks,
      );
      if (!res.error) setDraft(null);
      return res;
    }, `Added ${questions.length} question(s) and ${tasks.length} task(s) to the bank.`);
  }

  const sectionTitle = (id: string) =>
    sections.find((s) => s.id === id)?.title ?? 'Topic';

  if (sections.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
        Add curriculum sections first — drafting is grounded per topic (section).
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {/* Documents */}
      <div className={cn(cardClass, 'p-5')}>
        <h2 className="text-lg font-semibold text-neutral-900">
          Course documents
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Upload the material (PDF or Word) the AI should draft questions from.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-signal-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-signal-800"
          />
          <button
            onClick={upload}
            disabled={pending}
            className={btn('secondary', 'sm')}
          >
            Upload
          </button>
        </div>

        {documents.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <PiFilePdf className="h-5 w-5 shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-800">
                    {d.filename}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {(d.charCount / 1000).toFixed(1)}k characters extracted
                  </p>
                </div>
                <button
                  onClick={() =>
                    run(() => deleteDocument(courseId, d.id), 'Document removed.')
                  }
                  disabled={pending}
                  aria-label="Delete document"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Draft */}
      <div className={cn(cardClass, 'p-5')}>
        <h2 className="text-lg font-semibold text-neutral-900">Draft with AI</h2>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Upload a document above to start drafting.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Document</label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className={inputClass}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>
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
              <label className={labelClass}>Questions</label>
              <input
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        )}
        {documents.length > 0 && (
          <button
            onClick={generate}
            disabled={pending || !documentId || !sectionId}
            className={cn(btn('primary', 'sm'), 'mt-4')}
          >
            <PiMagicWand className="h-4 w-4" />
            {pending && !draft ? 'Drafting…' : 'Draft with AI'}
          </button>
        )}
      </div>

      {/* Review */}
      {draft && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">
              Review drafts — {sectionTitle(draft.sectionId)}
            </h2>
            <span className="text-xs font-medium text-neutral-500">
              AI-generated · review before adding
            </span>
          </div>

          {draft.questions.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-neutral-700">
                Questions
              </h3>
              <ul className="mt-2 space-y-2">
                {draft.questions.map((q, i) => (
                  <li
                    key={i}
                    className={cn(
                      cardClass,
                      'p-4',
                      !qSel.has(i) && 'opacity-50',
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={qSel.has(i)}
                        onChange={() =>
                          setQSel((prev) => {
                            const n = new Set(prev);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{q.body}</p>
                        <ul className="mt-1.5 space-y-1">
                          {q.options.map((opt, oi) => (
                            <li
                              key={oi}
                              className={cn(
                                'text-sm',
                                oi === q.correctIndex
                                  ? 'font-semibold text-emerald-700'
                                  : 'text-neutral-600',
                              )}
                            >
                              {oi === q.correctIndex ? '✓ ' : '· '}
                              {opt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {draft.tasks.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-neutral-700">
                Remediation tasks
              </h3>
              <ul className="mt-2 space-y-2">
                {draft.tasks.map((t, i) => (
                  <li
                    key={i}
                    className={cn(
                      cardClass,
                      'p-4',
                      !tSel.has(i) && 'opacity-50',
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={tSel.has(i)}
                        onChange={() =>
                          setTSel((prev) => {
                            const n = new Set(prev);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{t.title}</p>
                        {t.instructions && (
                          <p className="mt-0.5 text-sm text-neutral-600">
                            {t.instructions}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={accept}
              disabled={pending}
              className={btn('primary', 'sm')}
            >
              Add selected to bank
            </button>
            <button
              onClick={() => setDraft(null)}
              className={btn('ghost', 'sm')}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
