import { writable } from 'svelte/store';
import type { LinkState } from './connection-link';

export const canvasLink = writable<LinkState | null>(null);
