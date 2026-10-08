import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { PluginInfo } from '@/lib/types';

export * from './plugin-constants';

/**
 * Keys of the add-on packs enabled for the current user's org. Fails closed —
 * any error (no org, network) yields an empty set, so a gated feature stays
 * hidden rather than flashing on. Pass a token you already have to avoid a
 * second cookie read.
 */
export async function enabledPluginKeys(token?: string): Promise<Set<string>> {
  const t = token ?? (await getToken());
  if (!t) return new Set();
  const plugins = await api<PluginInfo[]>('/organizations/plugins', {
    token: t,
  }).catch(() => [] as PluginInfo[]);
  return new Set(plugins.filter((p) => p.enabled).map((p) => p.key));
}

/** Whether a single pack is on for the current user's org. */
export async function isPluginEnabled(
  key: string,
  token?: string,
): Promise<boolean> {
  return (await enabledPluginKeys(token)).has(key);
}

/**
 * Synchronous check whether a plugin pack is active for a course given an org fallback.
 * If course.pluginKeys is an array, it takes precedence. Otherwise falls back to org.
 */
export function isCoursePluginActive(
  course: { pluginKeys?: string[] | null } | null | undefined,
  key: string,
  fallbackOrgEnabled: boolean,
): boolean {
  if (course && Array.isArray(course.pluginKeys)) {
    return course.pluginKeys.includes(key);
  }
  return fallbackOrgEnabled;
}

/**
 * Resolves whether a pack is active for a course, checking course.pluginKeys
 * first and querying organization-wide plugins as fallback.
 */
export async function isPluginActiveForCourse(
  course: { pluginKeys?: string[] | null } | null | undefined,
  key: string,
  token?: string,
): Promise<boolean> {
  if (course && Array.isArray(course.pluginKeys)) {
    return course.pluginKeys.includes(key);
  }
  return isPluginEnabled(key, token);
}

