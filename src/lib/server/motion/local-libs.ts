import { existsSync, statSync } from 'node:fs';
import { extname, join, relative, isAbsolute } from 'node:path';
import { MOTION_LIBS_ROUTE } from '@feega/motion-core/motion/libs/catalog';

export const LOCAL_LIBS_DIR = 'static/motion-libs';

const TYPE: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const BINARY = 'application/octet-stream';

export type LocalLib = { path: string; type: string };

export function localLib(url: string, origin: string, root: string): LocalLib | null {
  const asked = new URL(url);
  const prefix = `${MOTION_LIBS_ROUTE}/`;
  if (asked.origin !== new URL(origin).origin || !asked.pathname.startsWith(prefix)) {
    return null;
  }

  const path = join(root, decodeURIComponent(asked.pathname.slice(prefix.length)));
  const inside = relative(root, path);
  if (inside.startsWith('..') || isAbsolute(inside) || !existsSync(path) || !statSync(path).isFile()) {
    return null;
  }
  return { path, type: TYPE[extname(path)] ?? BINARY };
}
