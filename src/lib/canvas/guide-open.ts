import { writable } from 'svelte/store';

export const guideOpenRequest = writable<string | null>(null);

export function requestGuide(path: string) {
  guideOpenRequest.set(path);
}
