import { gzipSync } from 'fflate';
import { fitsTar, tarOf } from './tar';

export type PickedFile = { path: string; size: number; bytes: () => Promise<Uint8Array> };

export enum SnapshotRefusal {
  NoPackage = 'no_package',
  TooBig = 'too_big',
  TooMany = 'too_many'
}

export const SNAPSHOT_LIMITS = { fileBytes: 1_000_000, totalBytes: 25_000_000, files: 4_000 };

export const SNAPSHOT_MESSAGES: Record<SnapshotRefusal, string> = {
  [SnapshotRefusal.NoPackage]: 'That folder has no package.json at its top: pick the folder of the app itself.',
  [SnapshotRefusal.TooBig]: `That folder holds more than ${SNAPSHOT_LIMITS.totalBytes / 1_000_000} MB of source, even without node_modules, build output and what .gitignore leaves out.`,
  [SnapshotRefusal.TooMany]: `That folder holds more than ${SNAPSHOT_LIMITS.files} source files, even without node_modules, build output and what .gitignore leaves out.`
};

export type Snapshot = { ok: true; name: string; archive: Uint8Array; files: number; skipped: string[] } | { ok: false; refusal: SnapshotRefusal };

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', '.next', '.nuxt', '.output', '.vercel', '.turbo', '.cache', '.parcel-cache', 'dist', 'build', 'out', 'coverage']);

const GITIGNORE = '.gitignore';
const PACKAGE = 'package.json';
const SAFE_NAME = /[^A-Za-z0-9._-]+/g;
const NAME_MAX = 60;
const FALLBACK_NAME = 'folder';

export const keptDir = (name: string) => !SKIPPED_DIRS.has(name);

type Rule = { base: string; re: RegExp; negate: boolean; dirOnly: boolean };

const escaped = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

function globSource(glob: string): string {
  return glob
    .split(/(\*\*\/|\/\*\*|\*\*|\*|\?)/)
    .map((part) => ({ '**/': '(?:.*/)?', '/**': '(?:/.*)?', '**': '.*', '*': '[^/]*', '?': '[^/]' })[part] ?? escaped(part))
    .join('');
}

function ruleOf(base: string, line: string): Rule | null {
  const raw = line.replace(/\s+$/, '');
  if (!raw || raw.startsWith('#')) {
    return null;
  }
  const negate = raw.startsWith('!');
  const body = negate ? raw.slice(1) : raw;
  const dirOnly = body.endsWith('/');
  const trimmed = body.replace(/\/+$/, '');
  const anchored = trimmed.includes('/');
  const pattern = trimmed.replace(/^\//, '');
  return pattern ? { base, negate, dirOnly, re: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${globSource(pattern)}$`) } : null;
}

export function rulesOf(base: string, text: string): Rule[] {
  return text.split(/\r?\n/).flatMap((line) => ruleOf(base, line) ?? []);
}

function within(base: string, path: string): string | null {
  if (!base) {
    return path;
  }
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : null;
}

export function ignoredBy(rules: Rule[], path: string, dir: boolean): boolean {
  let ignored = false;
  for (const rule of rules) {
    const rel = within(rule.base, path);
    if (rel === null || (rule.dirOnly && !dir) || !rule.re.test(rel)) {
      continue;
    }
    ignored = !rule.negate;
  }
  return ignored;
}

const parentsOf = (path: string) => path.split('/').slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join('/'));

function keptFile(rules: Rule[], path: string): boolean {
  const dirs = parentsOf(path);
  if (dirs.some((d) => !keptDir(d.split('/').at(-1)!) || ignoredBy(rules, d, true))) {
    return false;
  }
  return !ignoredBy(rules, path, false) && fitsTar(path);
}

async function ignoreRules(files: PickedFile[]): Promise<Rule[]> {
  const ignores = files.filter((f) => f.path === GITIGNORE || f.path.endsWith(`/${GITIGNORE}`));
  const rules = await Promise.all(ignores.map(async (f) => rulesOf(f.path.slice(0, -GITIGNORE.length).replace(/\/$/, ''), new TextDecoder().decode(await f.bytes()))));
  return rules.flat();
}

export const folderNameOf = (raw: string) => raw.replace(SAFE_NAME, '-').replace(/^[-.]+|-+$/g, '').slice(0, NAME_MAX) || FALLBACK_NAME;

export async function snapshotOf(folder: string, picked: PickedFile[]): Promise<Snapshot> {
  if (!picked.some((f) => f.path === PACKAGE)) {
    return { ok: false, refusal: SnapshotRefusal.NoPackage };
  }

  const rules = await ignoreRules(picked);
  const kept = picked.filter((f) => keptFile(rules, f.path));
  const skipped = kept.filter((f) => f.size > SNAPSHOT_LIMITS.fileBytes).map((f) => f.path);
  const packed = kept.filter((f) => f.size <= SNAPSHOT_LIMITS.fileBytes);
  if (packed.length > SNAPSHOT_LIMITS.files) {
    return { ok: false, refusal: SnapshotRefusal.TooMany };
  }
  if (packed.reduce((n, f) => n + f.size, 0) > SNAPSHOT_LIMITS.totalBytes) {
    return { ok: false, refusal: SnapshotRefusal.TooBig };
  }

  const name = folderNameOf(folder);
  const files = await Promise.all(packed.map(async (f) => ({ path: `${name}/${f.path}`, bytes: await f.bytes() })));
  return { ok: true, name, archive: gzipSync(tarOf(files)), files: files.length, skipped };
}
