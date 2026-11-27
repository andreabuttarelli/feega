import { existsSync, watch as nodeWatch } from 'node:fs';
import { join } from 'node:path';
import { WATCHED, relativeOf } from './file-watch';
import { scanProject } from './project-scan';

export type Batch = { structure: string[]; content: string[] };

type Options = { debounceMs?: number };

const DEFAULT_DEBOUNCE_MS = 200;

export function watchProject(root: string, onBatch: (batch: Batch) => void, { debounceMs = DEFAULT_DEBOUNCE_MS }: Options = {}) {
  const structure = new Set<string>();
  const content = new Set<string>();
  const known = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  void scanProject(root, Infinity).then(({ sheets, sources }) => [...sheets, ...sources].forEach((full) => known.add(relativeOf(root, full))));

  function flush() {
    timer = null;
    const batch = { structure: [...structure], content: [...content].filter((path) => !structure.has(path)) };
    structure.clear();
    content.clear();
    onBatch(batch);
  }

  function heard(_event: string, name: string | Buffer | null) {
    const path = name ? relativeOf(root, join(root, String(name))) : '';
    if (!path || !WATCHED(path)) {
      return;
    }
    const exists = existsSync(join(root, path));
    const edited = exists && known.has(path);
    if (exists) {
      known.add(path);
    } else {
      known.delete(path);
    }
    (edited ? content : structure).add(path);
    timer ??= setTimeout(flush, debounceMs);
  }

  let handle: ReturnType<typeof nodeWatch> | null = null;
  try {
    handle = nodeWatch(root, { recursive: true, persistent: false }, heard);
    handle.on('error', () => undefined);
  } catch {
    handle = null;
  }

  return {
    dispose() {
      handle?.close();
      handle = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
}
