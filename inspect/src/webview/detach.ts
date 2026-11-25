import type { Pick } from '../messages';

type Fields<K extends keyof Pick> = { [P in K]: Pick[P] };

export type DetachPick = Fields<'source' | 'component' | 'instances'>;

export type DetachState = { show: boolean; reason?: string };

const DETACHABLE_EXTENSIONS = new Set(['tsx', 'jsx', 'svelte', 'vue', 'astro']);
const UNSUPPORTED_KIND = 'Detach works on React, Svelte, Vue and Astro components';

const extensionOf = (file: string) => file.slice(file.lastIndexOf('.') + 1);

export function detachState(pick: DetachPick | null): DetachState {
  if (!pick?.component) {
    return { show: false };
  }
  return DETACHABLE_EXTENSIONS.has(extensionOf(pick.source.file)) ? { show: true } : { show: true, reason: UNSUPPORTED_KIND };
}
