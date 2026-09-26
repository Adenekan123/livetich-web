import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/ui';

/**
 * Instructor-authored prose — assignment instructions today, anywhere else that
 * needs formatting later.
 *
 * Markdown rather than HTML on purpose: react-markdown escapes raw HTML unless
 * `rehype-raw` is added, so there is no sanitiser here to get wrong and no way
 * for a `<script>` in an instructions field to reach a student's browser.
 *
 * `remark-breaks` turns single newlines into line breaks. Markdown normally
 * collapses them, which would silently reflow every assignment written before
 * this box understood formatting — the old field was a plain textarea and people
 * wrote in it accordingly.
 */
export function RichText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-2 text-sm leading-relaxed text-neutral-700',
        // Tailwind's typography plugin isn't in this project, so the handful of
        // elements markdown can produce are styled directly.
        '[&_a]:font-semibold [&_a]:text-signal-700 [&_a]:underline hover:[&_a]:text-signal-600',
        '[&_strong]:font-semibold [&_strong]:text-neutral-900',
        '[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-neutral-900',
        '[&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-neutral-900',
        '[&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-neutral-900',
        '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
        '[&_code]:rounded [&_code]:bg-neutral-200/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre]:text-xs',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600',
        '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-left',
        '[&_th]:border-b [&_th]:border-neutral-300 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-neutral-900',
        '[&_td]:border-b [&_td]:border-neutral-200 [&_td]:pr-4 [&_td]:align-top',
        '[&_hr]:my-3 [&_hr]:border-neutral-200',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Links leave the classroom, so they open away from it and cannot
          // reach back through window.opener.
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
