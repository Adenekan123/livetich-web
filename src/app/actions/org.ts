'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { OrgInvite, UserStatus } from '@/lib/types';

export interface OrgActionState {
  error: string | null;
  /** Bumped on each successful save so client forms can flash a confirmation. */
  ok?: number;
}

async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) redirect('/login');
  return fn(token);
}

/** Create an invite link and return it (the UI shows the shareable URL). */
export async function createInvite(
  _prev: { error: string | null; invite?: OrgInvite },
  formData: FormData,
): Promise<{ error: string | null; invite?: OrgInvite }> {
  const role = formData.get('role');
  const label = formData.get('label') || undefined;
  const courseId = formData.get('courseId') || undefined;
  try {
    const invite = await withToken((token) =>
      api<OrgInvite>('/organizations/invites', {
        method: 'POST',
        token,
        body: { role, label, courseId },
      }),
    );
    revalidatePath('/dashboard');
    if (typeof courseId === 'string') revalidatePath(`/courses/${courseId}`);
    return { error: null, invite };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function revokeInvite(id: string, courseId?: string): Promise<void> {
  await withToken((token) =>
    api(`/organizations/invites/${id}`, { method: 'DELETE', token }),
  );
  revalidatePath('/dashboard');
  if (courseId) revalidatePath(`/courses/${courseId}`);
}

/** Admin enables/disables an org member. Returns an error message on failure. */
export async function setMemberStatus(
  memberId: string,
  status: UserStatus,
): Promise<{ error: string | null }> {
  try {
    await withToken((token) =>
      api(`/organizations/members/${memberId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/account/students');
  revalidatePath('/account/instructors');
  return { error: null };
}

export async function assignInstructor(
  courseId: string,
  instructorId: string,
): Promise<void> {
  await withToken((token) =>
    api(`/courses/${courseId}/instructor`, {
      method: 'PATCH',
      token,
      body: { instructorId: instructorId || undefined },
    }),
  );
  revalidatePath('/dashboard');
  revalidatePath(`/courses/${courseId}`);
}

/** Admin turns an add-on pack on or off for their org. Free during the pilot. */
export async function setPluginEnabled(
  key: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  try {
    await withToken((token) =>
      api(`/organizations/plugins/${key}`, {
        method: enabled ? 'POST' : 'DELETE',
        token,
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/account/add-ons');
  return { error: null };
}

export async function updateBrand(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  try {
    await withToken((token) =>
      api('/organizations/me', {
        method: 'PATCH',
        token,
        body: {
          name: formData.get('name') || undefined,
          tagline: formData.get('tagline') || undefined,
          primaryColor: formData.get('primaryColor') || undefined,
          logoUrl: formData.get('logoUrl') || undefined,
        },
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  return { error: null };
}

export interface ClassPreferencesInput {
  evictOnInstructorLeave: boolean;
  micRequiresRaisedHand: boolean;
  preClassReminder: boolean;
  reminderLeadMinutes: number;
  /** Default invite-link lifetime in days; 0 = never expire. */
  inviteLinkExpiryDays: number;
}

/** Save the org's class preferences (admin). Called directly with the current
 *  toggle values (no <form action>, which would auto-reset the controls). */
export async function updateOrgSettings(
  values: ClassPreferencesInput,
): Promise<OrgActionState> {
  const lead = Number(values.reminderLeadMinutes);
  try {
    await withToken((token) =>
      api('/organizations/settings', {
        method: 'PATCH',
        token,
        body: {
          evictOnInstructorLeave: values.evictOnInstructorLeave,
          micRequiresRaisedHand: values.micRequiresRaisedHand,
          preClassReminder: values.preClassReminder,
          inviteLinkExpiryDays: Math.max(
            0,
            Number(values.inviteLinkExpiryDays) || 0,
          ),
          ...(Number.isFinite(lead) && lead > 0
            ? { reminderLeadMinutes: lead }
            : {}),
        },
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/account/preferences');
  return { error: null, ok: Date.now() };
}
