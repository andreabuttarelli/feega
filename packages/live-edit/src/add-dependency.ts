export type Depended = { ok: true; after: string } | { ok: false; reason: string };

const DEFAULT_INDENT = '  ';
const INDENT = /^\{\r?\n([ \t]+)"/;

export function addDependency(source: string | null, name: string, version: string, dev = false): Depended {
  if (source === null) {
    return { ok: false, reason: 'package.json not found' };
  }
  let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    manifest = JSON.parse(source);
  } catch {
    return { ok: false, reason: 'package.json is not valid JSON' };
  }
  if (manifest.dependencies?.[name] || manifest.devDependencies?.[name]) {
    return { ok: true, after: source };
  }
  const key = dev ? 'devDependencies' : 'dependencies';
  const group = Object.fromEntries(Object.entries({ ...manifest[key], [name]: version }).sort(([a], [b]) => a.localeCompare(b)));
  const indent = source.match(INDENT)?.[1] ?? DEFAULT_INDENT;
  const ending = source.endsWith('\n') ? '\n' : '';
  return { ok: true, after: JSON.stringify({ ...manifest, [key]: group }, null, indent) + ending };
}
