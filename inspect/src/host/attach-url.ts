import { isAbsolute, relative, sep } from 'node:path';

const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const STAMP = /data-feega-src="([^":]+):\d+:\d+"/;

export function urlOf(text: string): string | null {
  const typed = text.trim();
  if (!typed) {
    return null;
  }

  const parsed = parsedOf(SCHEME.test(typed) ? typed : `http://${typed}`);
  return parsed && WEB_PROTOCOLS.has(parsed.protocol) && parsed.hostname ? parsed.origin : null;
}

function parsedOf(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

export const firstStampedFile = (html: string): string | null => html.match(STAMP)?.[1] ?? null;

export function appOfSource(workspace: string, apps: string[], file: string): string | null {
  const inside = isAbsolute(file) ? relative(workspace, file).split(sep).join('/') : file;
  return apps.find((app) => app === '' || inside.startsWith(`${app}/`)) ?? null;
}
