import { sep } from 'node:path';

export const n = (path: string) => path.split('/').join(sep);
