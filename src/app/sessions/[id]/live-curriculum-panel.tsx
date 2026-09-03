'use client';

import { useEffect, useState } from 'react';
import { PiListChecksBold } from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type { Section } from '@/lib/types';

/**
 * The program's table of contents (curriculum sections), shown inside the live
 * class so the instructor can see what to cover without leaving the room. Read
 * from the course detail endpoint with the realtime token; instructor-only (the
 * classroom gates the toggle), so a plain student never opens it.
 */
export function LiveCurriculumPanel({ courseId }: { courseId: string }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getRealtimeToken();
        const res = await fetch(`${API_URL}/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok) throw new Error(`course fetch failed (${res.status})`);
        const data = (await res.json()) as { sections?: Section[] };
        if (!cancelled) {
          setSections(
            [...(data.sections ?? [])].sort((a, b) => a.order - b.order),
          );
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <PiListChecksBold className="h-3.5 w-3.5" /> Curriculum
      </h3>

      {error ? (
        <p className="mt-4 text-sm text-neutral-500">
          Couldn&apos;t load the curriculum. It&apos;s still available on the
          program page.
        </p>
      ) : sections === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading curriculum…</p>
      ) : sections.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No curriculum sections yet. Add them on the program page.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {sections.map((s, i) => (
            <li
              key={s.id}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
            >
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-signal-500/20 text-[11px] font-bold text-signal-300">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100">
                    {s.title}
                  </p>
                  {s.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
                      {s.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
