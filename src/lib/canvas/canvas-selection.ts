import { writable } from 'svelte/store';

export const canvasSelection = writable<string[]>([]);
