import { CANVAS_ADDABLE, AI_ADDABLE, type Addable } from './addable';

const ALWAYS_OFFERED: ReadonlySet<Addable> = new Set<Addable>(['products', 'social_account_feed']);

export const AI_PANEL_NODES: readonly Addable[] = CANVAS_ADDABLE.filter((what) => AI_ADDABLE.has(what) || ALWAYS_OFFERED.has(what));
