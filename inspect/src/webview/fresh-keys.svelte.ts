import { untrack } from 'svelte';
import { FRESH_MS, addedKeys } from './fresh';

export function freshKeys(keysOf: () => string[]) {
  let fresh = $state<string[]>([]);
  let before: string[] | null = null;

  $effect(() => {
    const now = keysOf();
    const added = addedKeys(before, untrack(() => now));
    before = now;
    if (!added.length) {
      return;
    }
    fresh = [...fresh, ...added];
    setTimeout(() => (fresh = fresh.filter((key) => !added.includes(key))), FRESH_MS);
  });

  return { has: (key: string) => fresh.includes(key) };
}
