import type { FrameSize } from './canvas-select';
import type { StoredSnap } from './canvas-snaps';

export const sessionSnaps = new Map<string, StoredSnap>();

export const sessionSizes = new Map<string, FrameSize>();
