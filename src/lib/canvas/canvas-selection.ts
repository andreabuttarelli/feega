import { writable } from 'svelte/store';

import type { SelectionChip } from '$lib/chat-selection';

export const canvasSelection = writable<string[]>([]);

export const canvasSelectionChips = writable<SelectionChip[]>([]);
