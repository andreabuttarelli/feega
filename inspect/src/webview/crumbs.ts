import { ElementState } from '@feega/live-edit/element-state';
import type { Pick, Source } from '../messages';
import { badgeOf } from './states';

export type Crumb = { name: string; source: Source | null; badge?: string };

const ELLIPSIS: Crumb = { name: '…', source: null };
const SHOWN = 3;

export function crumbsOf(pick: Pick, max = SHOWN, state = ElementState.Default): Crumb[] {
  const all: Crumb[] = [...pick.ancestors, { name: pick.name, source: pick.source, badge: badgeOf(state) || undefined }];
  return all.length <= max ? all : [ELLIPSIS, ...all.slice(-max)];
}
