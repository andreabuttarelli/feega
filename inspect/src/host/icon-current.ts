import { readFile } from 'node:fs/promises';
import { offsetOf } from '@feega/live-edit/class-patch';
import { inside, liveAtOf } from '@feega/live-edit/live-ask';

const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;
const OPEN_TAG = /^<([A-Za-z][\w]*)/;
const KEBAB_BOUNDARY = /([a-z0-9])([A-Z])/g;
const LIBRARY_AFFIX = /^icon-|-icon$/g;

export function iconNameOf(component: string): string | null {
  if (!COMPONENT.test(component)) {
    return null;
  }
  return component.replace(KEBAB_BOUNDARY, '$1-$2').toLowerCase().replace(LIBRARY_AFFIX, '');
}

export async function currentIcon(root: string, rawAt: string): Promise<string | null> {
  const at = liveAtOf(rawAt);
  const path = at ? inside(root, at.file) : null;
  const source = path ? await readFile(path, 'utf8').catch(() => null) : null;
  const start = at && source !== null ? offsetOf(source, at) : -1;
  const tag = start < 0 ? null : source!.slice(start).match(OPEN_TAG)?.[1];
  return tag ? iconNameOf(tag) : null;
}
