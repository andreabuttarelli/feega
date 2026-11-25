import type { ClassesView, ClassInfo } from '../messages';

export const classesState = $state<{ view: ClassesView | null; targetKey: string | null }>({ view: null, targetKey: null });

export const classOfKey = (view: ClassesView | null, key: string | null): ClassInfo | null => (key === null || !view ? null : ([...view.element, ...view.inFile].find((c) => c.key === key) ?? null));
