'use client';

import { useState, useTransition } from 'react';
import { PiPencilSimple, PiTrash, PiUsersThree, PiX } from 'react-icons/pi';
import {
  createGroup,
  deleteGroup,
  renameGroup,
  setGroupMembers,
} from '@/app/actions/groups';
import { btn, cardClass, cn, inputClass } from '@/lib/ui';
import type { StudentGroup } from '@/lib/types';

type RosterStudent = { id: string; name: string; email: string };

/**
 * Instructor/admin surface for a course's student groups: create, rename,
 * delete, and edit membership (a checkbox list drawn from the enrolled roster).
 * Groups are how assignments get targeted at a slice of the class.
 */
export function GroupsManager({
  courseId,
  groups,
  roster,
}: {
  courseId: string;
  groups: StudentGroup[];
  roster: RosterStudent[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<StudentGroup | null>(null);

  function act(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    act(async () => {
      const res = await createGroup(courseId, name);
      if (!res.error) setNewName('');
      return res;
    });
  }

  return (
    <section className="mt-8">
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Create */}
      <form
        onSubmit={onCreate}
        className={cn(cardClass, 'flex flex-wrap items-center gap-3 p-4')}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New group name (e.g. Beginners, Group A)"
          maxLength={80}
          className={cn(inputClass, 'flex-1')}
        />
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className={btn('primary', 'sm')}
        >
          + Create group
        </button>
      </form>

      {/* List */}
      {groups.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          No groups yet. Create one, then target assignments at it instead of the
          whole class.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              pending={pending}
              onManage={() => setEditing(g)}
              onRename={(name) => act(() => renameGroup(courseId, g.id, name))}
              onDelete={() => act(() => deleteGroup(courseId, g.id))}
            />
          ))}
        </div>
      )}

      {editing && (
        <MembersModal
          key={editing.id}
          group={editing}
          roster={roster}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(ids) => {
            act(() => setGroupMembers(courseId, editing.id, ids));
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function GroupCard({
  group,
  pending,
  onManage,
  onRename,
  onDelete,
}: {
  group: StudentGroup;
  pending: boolean;
  onManage: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);

  const preview = group.members
    .slice(0, 3)
    .map((m) => m.student.name)
    .join(', ');
  const extra = group._count.members - Math.min(3, group.members.length);

  return (
    <div className={cn(cardClass, 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (trimmed && trimmed !== group.name) onRename(trimmed);
              setRenaming(false);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={cn(inputClass, 'py-1.5')}
            />
            <button type="submit" className={btn('primary', 'sm')} disabled={pending}>
              Save
            </button>
          </form>
        ) : (
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-neutral-950">
              {group.name}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-400">
              {group._count.members}{' '}
              {group._count.members === 1 ? 'student' : 'students'}
              {group._count.assignments > 0 && (
                <>
                  <span className="mx-1.5 text-neutral-300">·</span>
                  {group._count.assignments} assignment
                  {group._count.assignments === 1 ? '' : 's'}
                </>
              )}
            </p>
          </div>
        )}

        {!renaming && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                setName(group.name);
                setRenaming(true);
              }}
              aria-label="Rename group"
              className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <PiPencilSimple className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete “${group.name}”? Assignments targeting it revert to the whole class.`,
                  )
                )
                  onDelete();
              }}
              aria-label="Delete group"
              disabled={pending}
              className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <PiTrash className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 min-h-[1.25rem] truncate text-sm text-neutral-500">
        {group._count.members === 0
          ? 'No members yet'
          : `${preview}${extra > 0 ? ` +${extra} more` : ''}`}
      </p>

      <button
        onClick={onManage}
        className={cn(btn('secondary', 'sm'), 'mt-3 w-full justify-center')}
      >
        <PiUsersThree className="h-4 w-4" /> Manage members
      </button>
    </div>
  );
}

function MembersModal({
  group,
  roster,
  pending,
  onClose,
  onSave,
}: {
  group: StudentGroup;
  roster: RosterStudent[];
  pending: boolean;
  onClose: () => void;
  onSave: (studentIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.members.map((m) => m.studentId)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Members of ${group.name}`}
        className="my-4 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
            {group.name}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {selected.size} of {roster.length} selected
        </p>

        {roster.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-5 text-sm text-neutral-500">
            No students are enrolled in this program yet.
          </p>
        ) : (
          <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto pr-1">
            {roster.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {s.name}
                    </span>
                    <span className="block truncate text-xs text-neutral-400">
                      {s.email}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => onSave([...selected])}
            disabled={pending}
            className={btn('primary', 'sm')}
          >
            Save members
          </button>
          <button onClick={onClose} className={btn('ghost', 'sm')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
