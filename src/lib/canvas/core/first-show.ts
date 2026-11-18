import { viewOf } from '$lib/canvas/breakpoint-views';

export const VECTORS = ':vectors';

export const showsBeforeMedia = (frameId: string, shown: boolean): boolean => !shown && viewOf(frameId) !== null;

export const beforeMediaGroup = (key: string): string => `${key}${VECTORS}`;
