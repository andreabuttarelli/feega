import { Scope } from '@feega/live-edit/scoped-rule';
import type { Pick } from '../messages';

type Fields<K extends keyof Pick> = { [P in K]: Pick[P] };

export type DetachPick = Fields<'source' | 'component' | 'instances'>;

export type DetachState = { show: boolean; reason?: string };

export type SharedFacts = { pick: DetachPick | null; scope: Scope; dismissed: Set<string>; enabled: boolean };

const DETACHABLE_EXTENSIONS = new Set(['tsx', 'jsx', 'svelte', 'vue', 'astro']);
const UNSUPPORTED_KIND = 'Detach works on React, Svelte, Vue and Astro components';

const extensionOf = (file: string) => file.slice(file.lastIndexOf('.') + 1);

export function detachState(pick: DetachPick | null): DetachState {
  if (!pick?.component) {
    return { show: false };
  }
  return DETACHABLE_EXTENSIONS.has(extensionOf(pick.source.file)) ? { show: true } : { show: true, reason: UNSUPPORTED_KIND };
}

export function sharedWarning({ pick, scope, dismissed, enabled }: SharedFacts): { instances: number; component: string } | null {
  const shared = enabled && pick && scope === Scope.Element && pick.instances > 1 && !dismissed.has(pick.source.file);
  return shared && pick ? { instances: pick.instances, component: pick.source.file } : null;
}
