import { getContext, setContext } from 'svelte';
import type { MotionClip } from './doc';

export type SelectionView = { readonly ids: readonly string[]; readonly clip: MotionClip | null };

const SELECTION = Symbol('motion-selection');

export const provideSelection = (view: SelectionView): SelectionView => setContext(SELECTION, view);

export const selectionView = (): SelectionView | undefined => getContext<SelectionView | undefined>(SELECTION);
