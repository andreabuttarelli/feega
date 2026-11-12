import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BUILTIN_PREFIX } from './design-kit';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';
import ARC_SETS from './arc/arc-doc.json';

export const ARC_GROUP = 'Arc';
export const ARC_PREFIX = `${BUILTIN_PREFIX}arc-`;

const GROUP_SEPARATOR = ' · ';

type ArcSet = { name: string; slug: string; description: string; doc: unknown };

function parsed(set: ArcSet): MotionDoc {
  const verdict = parseMotionDoc(set.doc);
  if (!verdict.ok) {
    throw new Error(`Arc ${set.slug}: ${verdict.error}`);
  }
  return verdict.doc;
}

export const ARC_TEMPLATES: TemplateEntry[] = (ARC_SETS as ArcSet[]).map((set) => ({
  id: `${ARC_PREFIX}${set.slug}`,
  template: lazyTemplate(() => parsed(set), { name: `${ARC_GROUP}${GROUP_SEPARATOR}${set.name}`, description: set.description, keyFields: undefined })
}));
