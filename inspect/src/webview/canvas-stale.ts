import type { ComponentRow } from '../host/component-list';
import { pageOfFile } from '../host/page-route';
import type { CanvasFrame } from './canvas-layout';
import { keyOfComponent } from './components';

export function pageKeysOf(frames: CanvasFrame[], files: string[]): string[] {
  const routes = new Set(files.flatMap((file) => pageOfFile(file)?.route ?? []));

  return frames.filter((frame) => routes.has(frame.route)).map((frame) => frame.key);
}

export const componentKeysOf = (rows: ComponentRow[], files: string[]): string[] => rows.filter((row) => files.includes(row.file)).map(keyOfComponent);

export function forgetPages(store: Map<string, unknown>, files: string[]) {
  const routes = new Set(files.flatMap((file) => pageOfFile(file)?.route ?? []));
  for (const key of [...store.keys()]) {
    if (routes.has(key.slice(0, key.lastIndexOf('::')))) {
      store.delete(key);
    }
  }
}
