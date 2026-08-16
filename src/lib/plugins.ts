import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { PluginInfo } from '@/lib/types';

/** Add-on pack keys, mirrored from the API catalog. Feature code gates on these. */
export const PLUGIN_ISLAMIC_EDUCATION = 'islamic-education';
export const PLUGIN_CODE_INSTRUCTION = 'code-instruction';
export const PLUGIN_TEST_PREP = 'test-prep';

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
