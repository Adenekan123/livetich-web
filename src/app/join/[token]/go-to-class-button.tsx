'use client';

import { useState, useTransition } from 'react';
import { switchWorkspace } from '@/app/actions/auth';
import { btn } from '@/lib/ui';

/**
 * For someone reopening a program link they already enrolled through, while
 * signed into a different workspace: switch into the program's workspace and
 * land on the class. The switch is a click rather than automatic because it
 * changes which school the rest of the app shows them.
 */
export function GoToClassButton({
  organizationId,
  classLink,
}: {
  organizationId: string;
  classLink: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            // Success redirects; only a failure comes back here.
            try {
              await switchWorkspace(organizationId, classLink);
            } catch {
              setError('Could not open the class. Try again.');
            }
          })
        }
        className={btn('primary', 'xl', 'w-full')}
      >
        {pending ? 'Opening…' : 'Go to class →'}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
