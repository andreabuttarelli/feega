import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BUILTIN_PREFIX } from './design-kit';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';

const GROUP_SEPARATOR = ' · ';

type ShippedSet = { name: string; slug: string; description: string; doc: unknown };

export const shippedSlugPrefix = (group: string) => `${group.toLowerCase()}-`;

function parsed(group: string, set: ShippedSet): MotionDoc {
  const verdict = parseMotionDoc(set.doc);
  if (!verdict.ok) {
    throw new Error(`${group} ${set.slug}: ${verdict.error}`);
  }
  return verdict.doc;
}

export function shippedLibrary(group: string, json: string): TemplateEntry[] {
  return (JSON.parse(json) as ShippedSet[]).map((set) => ({
    id: `${BUILTIN_PREFIX}${shippedSlugPrefix(group)}${set.slug}`,
    template: lazyTemplate(() => parsed(group, set), { name: `${group}${GROUP_SEPARATOR}${set.name}`, description: set.description, keyFields: undefined })
  }));
}
