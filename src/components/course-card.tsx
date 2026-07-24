import Link from 'next/link';
import { cardClass, cn } from '@/lib/ui';

/** Consistent course tile used on the browse, dashboard, and enrolled lists. */
export function CourseCard({
  href,
  title,
  description,
  meta,
  badge,
}: {
  href: string;
  title: string;
  description?: string | null;
  meta?: string[];
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        'group flex h-full flex-col p-5 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 transition group-hover:text-indigo-700">
          {title}
        </h3>
        {badge}
      </div>
      {description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{description}</p>
      ) : null}
      {meta && meta.length > 0 ? (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-xs text-slate-500">
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">·</span>}
              {m}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
