import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { authoredOffsets } from '@feega/live-edit/authored-offsets';
import { eventsOf } from '@feega/live-edit/event-handlers';
import { linkOf } from '@feega/live-edit/link-edit';
import { inside, liveAtOf, reader } from '@feega/live-edit/live-ask';
import { routesOf, vueRouterPaths } from '@feega/live-edit/routes';
import type { Wiring } from '../messages';

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.output', '.feega', 'dist', 'build', 'coverage']);
const MAX_DEPTH = 8;
const MAX_FILES = 4000;
const VUE_ROUTER_FILE = /(?:^|\/)router(?:\/index)?\.(?:ts|js)$/;
const NOTHING: Wiring = { link: null, events: [], routes: [], offsets: [] };

export async function filesIn(root: string, dir = '', depth = 0, found: string[] = []): Promise<string[]> {
  if (depth > MAX_DEPTH || found.length > MAX_FILES) {
    return found;
  }
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      await filesIn(root, path, depth + 1, found);
      continue;
    }
    if (entry.isFile()) {
      found.push(path);
    }
  }
  return found;
}

export async function routesIn(root: string): Promise<string[]> {
  const files = await filesIn(root);
  const read = reader(root);
  const vue = await Promise.all(files.filter((f) => VUE_ROUTER_FILE.test(f)).map(async (f) => vueRouterPaths((await read(f)) ?? '')));
  return [...new Set([...routesOf(files), ...vue.flat()])].sort();
}

export async function wiringOf(root: string, rawAt: string, instance?: number): Promise<Wiring> {
  const at = liveAtOf(rawAt);
  if (!at || !inside(root, at.file)) {
    return NOTHING;
  }
  const read = reader(root);
  const [link, events, routes, offsets] = await Promise.all([linkOf(read, at, instance), eventsOf(read, at), routesIn(root), authoredOffsets(read, at)]);
  return { link, events, routes, offsets };
}
