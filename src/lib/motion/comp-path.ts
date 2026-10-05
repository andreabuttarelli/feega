export const COMP_SEPARATOR = '__';

export function hostIdsOf(clipId: string): string[] {
  const parts = clipId.split(COMP_SEPARATOR);
  return Array.from({ length: Math.floor((parts.length - 1) / 2) }, (_, i) => parts.slice(0, 2 * i + 1).join(COMP_SEPARATOR));
}
