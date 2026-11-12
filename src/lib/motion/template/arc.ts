import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BUILTIN_PREFIX } from './design-kit';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';
import ARC_JSON from './arc/arc-doc.json?raw';
import ARC_SHOWS from './arc/arc-shows.json';

export const ARC_GROUP = 'Arc';
export const ARC_PREFIX = `${BUILTIN_PREFIX}arc-`;

const GROUP_SEPARATOR = ' · ';

type ArcSet = { name: string; slug: string; size: { width: number; height: number }; doc: unknown };

const SHOWS: Record<string, string> = ARC_SHOWS;

const arcDescription = (set: Pick<ArcSet, 'slug' | 'size'>) => `Still ${set.size.width}×${set.size.height} UI frame, no motion: ${SHOWS[set.slug]}`;

function parsed(set: ArcSet): MotionDoc {
  const verdict = parseMotionDoc(set.doc);
  if (!verdict.ok) {
    throw new Error(`Arc ${set.slug}: ${verdict.error}`);
  }
  return verdict.doc;
}

export const ARC_TEMPLATES: TemplateEntry[] = (JSON.parse(ARC_JSON) as ArcSet[]).map((set) => ({
  id: `${ARC_PREFIX}${set.slug}`,
  template: lazyTemplate(() => parsed(set), { name: `${ARC_GROUP}${GROUP_SEPARATOR}${set.name}`, description: arcDescription(set), keyFields: undefined })
}));
