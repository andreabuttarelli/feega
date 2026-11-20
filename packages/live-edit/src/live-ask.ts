import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { LiveProp, type Side } from './live-fields';
import type { LiveAt } from './class-patch';
import { liveTheme, tokenFor } from './live-tokens';

export type LiveEditAsk = { at: string; prop: LiveProp; family?: string; value?: string; token?: string; side?: Side; was?: string; rem?: number; viewport?: number };

const AT = /^(.+):(\d+):(\d+)$/;

export function liveAtOf(raw: string): LiveAt | null {
  const m = raw.match(AT);
  return m ? { file: m[1].replace(/^\.?\//, ''), line: Number(m[2]), col: Number(m[3]) } : null;
}

export const inside = (root: string, path: string) => {
  const full = normalize(join(root, path));
  return full.startsWith(normalize(root) + sep) ? full : null;
};

export const reader = (root: string) => async (path: string) => {
  const full = inside(root, path);
  return full ? readFile(full, 'utf8').catch(() => null) : null;
};

export async function tokenOf(root: string, ask: LiveEditAsk): Promise<string | null> {
  if (ask.prop === LiveProp.Text) {
    return null;
  }
  if (ask.prop === LiveProp.Class) {
    return ask.token ?? ask.value ?? '';
  }
  return ask.token ?? tokenFor(ask.prop, ask.value ?? '', await liveTheme(reader(root), ask.rem));
}
