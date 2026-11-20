import type { Pick, Source } from '../messages';

export type Crumb = { name: string; source: Source | null };

const ELLIPSIS: Crumb = { name: '…', source: null };
const SHOWN = 3;

export function crumbsOf(pick: Pick, max = SHOWN): Crumb[] {
  const all: Crumb[] = [...pick.ancestors, { name: pick.name, source: pick.source }];
  return all.length <= max ? all : [ELLIPSIS, ...all.slice(-max)];
}
