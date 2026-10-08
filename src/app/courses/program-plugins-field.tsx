'use client';

import { useState } from 'react';
import type { IconType } from 'react-icons';
import {
  PiCheckBold,
  PiCodeBold,
  PiExamBold,
  PiFunctionBold,
  PiMoonStarsBold,
} from 'react-icons/pi';
import { cn } from '@/lib/ui';
import {
  PLUGIN_CODE_INSTRUCTION,
  PLUGIN_ISLAMIC_EDUCATION,
  PLUGIN_MATHS_SCIENCES,
  PLUGIN_TEST_PREP,
} from '@/lib/plugin-constants';

export interface ProgramPluginOption {
  key: string;
  name: string;
  summary: string;
  tags: string[];
  icon: IconType;
  colorClass: {
    iconBg: string;
    iconText: string;
    activeBorder: string;
    activeBg: string;
  };
}

export const PROGRAM_PLUGINS: readonly ProgramPluginOption[] = [
  {
    key: PLUGIN_CODE_INSTRUCTION,
    name: 'Code Instruction',
    summary:
      'Live shared code editor with multi-language syntax highlighting. Perfect for computer science and web development.',
    tags: ['Live Code Board', 'Syntax Highlighting', 'Follow Instructor'],
    icon: PiCodeBold,
    colorClass: {
      iconBg: 'bg-blue-50 text-blue-700',
      iconText: 'text-blue-700',
      activeBorder: 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30',
      activeBg: 'bg-blue-600',
    },
  },
  {
    key: PLUGIN_ISLAMIC_EDUCATION,
    name: 'Islamic Education',
    summary:
      'Qur’an Mushaf reader, Tajweed color rules & assessment, student Hifz progress tracking, and RTL classroom mode.',
    tags: ['Mushaf Reader', 'Tajweed Rules', 'Hifz Tracker', 'RTL Layout'],
    icon: PiMoonStarsBold,
    colorClass: {
      iconBg: 'bg-emerald-50 text-emerald-700',
      iconText: 'text-emerald-700',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30',
      activeBg: 'bg-emerald-600',
    },
  },
  {
    key: PLUGIN_MATHS_SCIENCES,
    name: 'Maths & Sciences',
    summary:
      'Chalkboard equation and formula palette for fractions, roots, integrals, and matrices without needing manual LaTeX.',
    tags: ['Formula Palette', 'Chalkboard LaTeX', 'Interactive Math'],
    icon: PiFunctionBold,
    colorClass: {
      iconBg: 'bg-amber-50 text-amber-700',
      iconText: 'text-amber-700',
      activeBorder: 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/30',
      activeBg: 'bg-amber-600',
    },
  },
  {
    key: PLUGIN_TEST_PREP,
    name: 'Test Prep & Exams',
    summary:
      'Author timed mock exams from a question bank. Automatic clock countdown, instant auto-scoring, and topic analytics.',
    tags: ['Timed Mocks', 'Question Bank', 'Auto-scoring', 'Analytics'],
    icon: PiExamBold,
    colorClass: {
      iconBg: 'bg-purple-50 text-purple-700',
      iconText: 'text-purple-700',
      activeBorder: 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/30',
      activeBg: 'bg-purple-600',
    },
  },
];

interface ProgramPluginsFieldProps {
  initialSelected?: string[];
  name?: string;
  includeHiddenMarker?: boolean;
}

export function ProgramPluginsField({
  initialSelected = [],
  name = 'pluginKeys',
  includeHiddenMarker = false,
}: ProgramPluginsFieldProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectAll = () => {
    setSelected(PROGRAM_PLUGINS.map((p) => p.key));
  };

  const clearAll = () => {
    setSelected([]);
  };

  return (
    <div className="space-y-4">
      {includeHiddenMarker && (
        <input type="hidden" name="hasPluginSelection" value="1" />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-neutral-950">
            Teaching capabilities
          </span>
          {selected.length === 0 ? (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
              Standard classroom
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-signal-50 px-2.5 py-0.5 text-xs font-semibold text-signal-700">
              <PiCheckBold className="h-3 w-3" />
              {selected.length} {selected.length === 1 ? 'pack' : 'packs'} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="font-medium text-neutral-600 hover:text-signal-700 transition"
          >
            Select all
          </button>
          <span className="text-neutral-300">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="font-medium text-neutral-600 hover:text-signal-700 transition"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm text-neutral-600">
        Equip specialized interactive tools tailored to this program. You can select
        multiple packs or keep standard classroom capabilities (video, chat, screen share, and whiteboard).
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROGRAM_PLUGINS.map((plugin) => {
          const isChecked = selected.includes(plugin.key);
          const Icon = plugin.icon;

          return (
            <label
              key={plugin.key}
              className={cn(
                'group relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all duration-150 select-none',
                isChecked
                  ? cn('border-signal-600 bg-signal-50/20 shadow-xs ring-1 ring-signal-500/30')
                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50',
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={plugin.key}
                checked={isChecked}
                onChange={() => toggle(plugin.key)}
                className="sr-only"
              />

              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105',
                        plugin.colorClass.iconBg,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h4 className="text-sm font-semibold text-neutral-950">
                      {plugin.name}
                    </h4>
                  </div>

                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs transition-colors',
                      isChecked
                        ? 'border-signal-700 bg-signal-700 text-white'
                        : 'border-neutral-300 bg-white text-transparent group-hover:border-neutral-400',
                    )}
                    aria-hidden
                  >
                    <PiCheckBold className="h-3 w-3 stroke-[2.5]" />
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
                  {plugin.summary}
                </p>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
                {plugin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-neutral-100/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
