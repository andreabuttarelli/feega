import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Reply } from './cdn';

const NODE_MODULES = fileURLToPath(new URL('../../../node_modules/', import.meta.url));
const ADDRESS = /^https:\/\/([^/]+)\/npm\/((?:@[^/@]+\/)?[^/@]+)@([^/]+)\/(.+)$/;
const NOT_FOUND: Reply = { status: 404, text: 'Not found' };

export type Cdn = { fetch: (url: string) => Promise<Reply>; requests: string[]; offline: boolean };

export function localCdn(): Cdn {
  const cdn: Cdn = {
    requests: [],
    offline: false,
    fetch: async (url) => {
      cdn.requests.push(url);
      if (cdn.offline) {
        throw new Error('offline');
      }
      const [, , name, version, path] = url.match(ADDRESS) ?? [];
      const folder = `${NODE_MODULES}${name}/`;
      if (!name || !existsSync(`${folder}package.json`) || JSON.parse(readFileSync(`${folder}package.json`, 'utf8')).version !== version || !existsSync(`${folder}${path}`)) {
        return NOT_FOUND;
      }
      return { status: 200, text: readFileSync(`${folder}${path}`, 'utf8') };
    }
  };
  return cdn;
}
