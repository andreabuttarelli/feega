import { viewOf } from '$lib/canvas/breakpoint-views';

export const showsBeforeMedia = (frameId: string, shown: boolean): boolean => !shown && viewOf(frameId) !== null;
