'use client';

import { useRef, useState } from 'react';
import {
  PiCodeBold,
  PiLinkSimpleBold,
  PiListBulletsBold,
  PiListNumbersBold,
  PiQuotesBold,
  PiTextBBold,
  PiTextHOneBold,
  PiTextItalicBold,
} from 'react-icons/pi';
import { RichText } from '@/components/rich-text';
import { cn } from '@/lib/ui';

/**
 * A markdown box with a toolbar and a preview.
 *
 * Stays a plain `<textarea name=...>` underneath so it drops into an existing
 * form action without touching how the form submits — the toolbar only edits
 * the text, it does not change what gets posted. Anything typed before this
 * existed is still valid input; markdown degrades to the plain text it was.
 */

type Wrap = { kind: 'wrap'; before: string; after: string; placeholder: string };
type LinePrefix = { kind: 'line'; prefix: string; placeholder: string };
type Action = Wrap | LinePrefix;

const TOOLS: { label: string; icon: React.ReactNode; action: Action }[] = [
  {
    label: 'Bold',
    icon: <PiTextBBold />,
    action: { kind: 'wrap', before: '**', after: '**', placeholder: 'bold text' },
  },
  {
    label: 'Italic',
    icon: <PiTextItalicBold />,
    action: { kind: 'wrap', before: '_', after: '_', placeholder: 'italic text' },
  },
  {
    label: 'Heading',
    icon: <PiTextHOneBold />,
    action: { kind: 'line', prefix: '## ', placeholder: 'Heading' },
  },
  {
    label: 'Bulleted list',
    icon: <PiListBulletsBold />,
    action: { kind: 'line', prefix: '- ', placeholder: 'List item' },
  },
  {
    label: 'Numbered list',
    icon: <PiListNumbersBold />,
    action: { kind: 'line', prefix: '1. ', placeholder: 'List item' },
  },
  {
    label: 'Quote',
    icon: <PiQuotesBold />,
    action: { kind: 'line', prefix: '> ', placeholder: 'Quoted text' },
  },
  {
    label: 'Code',
    icon: <PiCodeBold />,
    action: { kind: 'wrap', before: '`', after: '`', placeholder: 'code' },
  },
  {
    label: 'Link',
    icon: <PiLinkSimpleBold />,
    action: { kind: 'wrap', before: '[', after: '](https://)', placeholder: 'link text' },
  },
];

export function MarkdownEditor({
  id,
  name,
  rows = 4,
  placeholder,
  defaultValue = '',
  className,
}: {
  id: string;
  name: string;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  function apply(action: Action) {
    const box = boxRef.current;
    const start = box?.selectionStart ?? value.length;
    const end = box?.selectionEnd ?? start;
    const selected = value.slice(start, end);

    let next: string;
    let caret: number;
    let length: number;

    if (action.kind === 'wrap') {
      const body = selected || action.placeholder;
      next =
        value.slice(0, start) +
        action.before +
        body +
        action.after +
        value.slice(end);
      caret = start + action.before.length;
      length = body.length;
    } else {
      // Prefix the line the cursor is on, not the cursor position itself.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const body = selected || action.placeholder;
      const alreadyPrefixed = value.slice(lineStart).startsWith(action.prefix);
      if (alreadyPrefixed) return;
      next =
        value.slice(0, lineStart) +
        action.prefix +
        value.slice(lineStart, start) +
        body +
        value.slice(end);
      caret = start + action.prefix.length;
      length = body.length;
    }

    setValue(next);
    // After React has applied the new value, or the selection is lost.
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret + length);
    });
  }

  return (
    <div className={cn('rounded-xl border border-neutral-300', className)}>
      <div className="flex items-center gap-0.5 border-b border-neutral-200 px-1.5 py-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            disabled={preview}
            onClick={() => apply(tool.action)}
            className="grid h-7 w-7 place-items-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
          >
            {tool.icon}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          {preview ? 'Write' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[5.5rem] px-3 py-2">
          {value.trim() === '' ? (
            <p className="text-sm text-neutral-400">Nothing to preview yet.</p>
          ) : (
            <RichText>{value}</RichText>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={boxRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded-b-xl px-3 py-2 text-sm text-neutral-900 outline-none"
        />
      )}

      {/* The value the form actually posts — present in either mode, so
          switching to Preview before submitting cannot drop the text. */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
