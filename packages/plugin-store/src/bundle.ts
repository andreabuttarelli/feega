import { parseManifest, type Manifest } from '@feega/plugin-api/manifest';

export const MANIFEST_FILE = 'feega-plugin.json';

const DEFAULT_MAIN = 'plugin.js';
const NETWORK = 'network:';

export type Bundle = { manifest: Manifest; main: string };

export type Read<T> = ({ ok: true } & T) | { ok: false; reason: string };

const safePath = (path: unknown): path is string => typeof path === 'string' && path !== '' && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');

export function bundleOf(text: string | undefined): Read<{ bundle: Bundle }> {
  if (text === undefined) {
    return { ok: false, reason: `there is no ${MANIFEST_FILE}` };
  }
  let raw: { main?: unknown };
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: `${MANIFEST_FILE} is not valid JSON` };
  }
  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const main = raw.main ?? DEFAULT_MAIN;
  return safePath(main) ? { ok: true, bundle: { manifest: parsed.manifest, main } } : { ok: false, reason: 'main must be a path inside the plugin folder' };
}

export const permissionsOf = (manifest: Manifest): string[] => [...manifest.grants, ...manifest.hosts.map((host) => `${NETWORK}${host}`)].sort();
