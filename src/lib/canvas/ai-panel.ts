import { CANVAS_ADDABLE, AI_ADDABLE, type Addable } from './addable';

export const AI_PANEL_NODES: readonly Addable[] = CANVAS_ADDABLE.filter((what) => AI_ADDABLE.has(what));
