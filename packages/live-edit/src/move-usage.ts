import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { Place, hiddenOut, moveNode } from './move-node';
import type { Structured } from './move-into';

export type Usage = { from: string; to: string; place: Place };

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function usageAt(text: string, file: string, name: string): LiveAt | null {
  const found = new RegExp(`<(${name}|${kebab(name)})(?=[\\s/>])`, 'i').exec(text);
  if (!found) {
    return null;
  }

  const before = text.slice(0, found.index).split('\n');
  return { file, line: before.length, col: before[before.length - 1].length + 1 };
}

export async function moveUsage(read: ReadFile, file: string, usage: Usage): Promise<Structured> {
  const source = await read(file);
  if (source === null) {
    return { ok: false, reason: `${file}: cannot read the file` };
  }

  const text = hiddenOut(source);
  const from = usageAt(text, file, usage.from);
  const to = usageAt(text, file, usage.to);
  if (!from || !to) {
    return { ok: false, reason: `${file}: no <${from ? usage.to : usage.from}> usage in this file` };
  }

  const out = await moveNode(read, from, to, usage.place);
  return out.ok ? { ok: true, changes: [out.change] } : out;
}
