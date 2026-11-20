import * as nodePath from 'node:path';

type PathApi = Pick<typeof nodePath, 'relative' | 'sep'>;

const toPosix = (path: string, api: PathApi) => (api.sep === '\\' ? path.split('\\').join('/') : path);

export const sourceId = (root: string, file: string, api: PathApi = nodePath) => toPosix(api.relative(root, file), api);

export const fsUrl = (file: string, api: PathApi = nodePath) => {
  const posix = toPosix(file, api);
  return `/@fs${posix.startsWith('/') ? '' : '/'}${posix}`;
};
