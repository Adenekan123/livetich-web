/** Add-on pack keys, mirrored from the API catalog. Feature code gates on these. */
export const PLUGIN_ISLAMIC_EDUCATION = 'islamic-education';
export const PLUGIN_CODE_INSTRUCTION = 'code-instruction';
export const PLUGIN_MATHS_SCIENCES = 'maths-sciences';
export const PLUGIN_TEST_PREP = 'test-prep';

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
