import { SOCKET_PATH } from '../../messages';

export enum Target {
  Editor = 'editor',
  App = 'app'
}

type Asked = { method: string; path: string; headers: Record<string, string> };

const EDITOR_ASSETS = new Set(['/panel.js', '/panel.css']);
const FRAMED = 'iframe';

const pathOf = (path: string) => path.split('?')[0];

export function targetOfRequest({ path, headers }: Asked): Target {
  const pathname = pathOf(path);
  if (EDITOR_ASSETS.has(pathname)) {
    return Target.Editor;
  }
  return pathname === '/' && headers['sec-fetch-dest'] !== FRAMED ? Target.Editor : Target.App;
}

export const targetOfSocket = (path: string): Target => (pathOf(path) === SOCKET_PATH ? Target.Editor : Target.App);
