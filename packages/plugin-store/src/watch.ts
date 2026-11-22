import { mkdirSync, watch as fsWatch } from 'node:fs';

const SETTLE_MS = 150;

export type Watch = (dir: string, onChange: () => void) => () => void;

export const fsWatcher: Watch = (dir, onChange) => {
  try {
    const watcher = fsWatch(dir, { recursive: true }, onChange);
    return () => watcher.close();
  } catch {
    return () => undefined;
  }
};

export type WatchDeps = { root: string; dev: string[]; onChange: () => void; watch?: Watch };

export function watchPlugins({ root, dev, onChange, watch = fsWatcher }: WatchDeps): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = () => {
    timer && clearTimeout(timer);
    timer = setTimeout(onChange, SETTLE_MS);
  };
  mkdirSync(root, { recursive: true });
  const stops = [root, ...dev].map((dir) => watch(dir, settle));
  return () => {
    timer && clearTimeout(timer);
    stops.forEach((stop) => stop());
  };
}
