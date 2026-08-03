import { avatarColor, cn, initials } from '@/lib/ui';

/** Compact avatar + name + email list, used for org rosters. */
export function MemberList({
  members,
  empty = 'Nobody yet.',
}: {
  members: { id: string; name: string; email: string }[];
  empty?: string;
}) {
  if (members.length === 0) {
    return <p className="mt-3 text-sm text-neutral-400">{empty}</p>;
  }
  return (
    <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
              avatarColor(m.id),
            )}
            aria-hidden
          >
            {initials(m.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-neutral-800">
              {m.name}
            </span>
            <span className="block truncate text-xs text-neutral-400">{m.email}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
