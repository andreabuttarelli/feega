import { access, readdir } from 'node:fs/promises';
import { type Tree } from '../../../inspect/src/host/app-root';

export const diskTree: Tree = {
  has: (path) => access(path).then(() => true, () => false),
  dirs: (path) => readdir(path, { withFileTypes: true }).then((all) => all.filter((e) => e.isDirectory()).map((e) => e.name), () => [])
};
