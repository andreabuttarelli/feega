import type { ReadAsk } from '../messages';
import type { Focus } from './focus';
import type { PropControl } from './prop-controls';

export type Mounted = { controls: PropControl[]; values: Record<string, unknown>; touched: string[]; dynamic: string[] };

type Found = { values: Record<string, unknown>; dynamic: string[] };

const READS_USAGE = new Set(['.svelte', '.astro']);

const extensionOf = (file: string) => file.slice(file.lastIndexOf('.'));

export function readAskOf(focus: Focus): ReadAsk | null {
  if (!focus.usage || !READS_USAGE.has(extensionOf(focus.source.file))) {
    return null;
  }
  const { file, line, col } = focus.usage.at;
  return { component: focus.source.file, usage: `${file}:${line}:${col}`, which: focus.usage.which };
}

export function withUsage(mount: Mounted, found: Found): Mounted {
  const known = new Set(mount.controls.map((control) => control.name));
  const edited = new Set(mount.touched);
  const literals = Object.entries(found.values).filter(([name]) => known.has(name) && !edited.has(name));
  return { ...mount, values: { ...mount.values, ...Object.fromEntries(literals) }, dynamic: found.dynamic.filter((name) => known.has(name)) };
}
