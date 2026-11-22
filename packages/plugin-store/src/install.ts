import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { wordsOf } from '@feega/plugin-api/permission-words';
import { MANIFEST_FILE, bundleOf, permissionsOf } from './bundle';
import type { Fetcher } from './fetcher';
import { readRegistry, writeRegistry } from './registry';
import { SourceKind, sourceOf, type PluginSource } from './source';
import { unpack } from './unpack';

export type { Fetcher } from './fetcher';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_HOST = 'registry.npmjs.org';
const GITHUB_CODELOAD = 'https://codeload.github.com';
const DEFAULT_BRANCH = 'HEAD';
const NPM_LATEST = 'latest';

export type Review = { id: string; name: string; version: string; words: string[] };

export type InstallDeps = { root: string; fetch: Fetcher; approve: (review: Review) => Promise<boolean> };

export type Outcome = { ok: true } | { ok: false; reason: string };

export type Installed = { ok: true; id: string; version: string } | { ok: false; reason: string };

async function npmTarball(source: Extract<PluginSource, { kind: SourceKind.Npm }>, fetch: Fetcher): Promise<string> {
  const path = source.name.replace('/', '%2F');
  const meta = JSON.parse(Buffer.from(await fetch(`${NPM_REGISTRY}/${path}/${source.version ?? NPM_LATEST}`)).toString('utf8')) as { dist?: { tarball?: string } };
  const tarball = meta.dist?.tarball;
  if (!tarball || !URL.canParse(tarball) || new URL(tarball).hostname !== NPM_HOST) {
    throw new Error(`the tarball of ${source.name} is not on the npm registry`);
  }
  return tarball;
}

async function download(source: PluginSource, fetch: Fetcher): Promise<Uint8Array> {
  if (source.kind === SourceKind.Github) {
    const ref = source.tag ? `refs/tags/${source.tag}` : DEFAULT_BRANCH;
    return fetch(`${GITHUB_CODELOAD}/${source.owner}/${source.repo}/tar.gz/${ref}`);
  }
  return fetch(await npmTarball(source, fetch));
}

async function write(dir: string, files: Map<string, Buffer>) {
  await rm(dirname(dir), { recursive: true, force: true });
  for (const [path, bytes] of files) {
    const target = join(dir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

async function install({ root, fetch, approve }: InstallDeps, text: string): Promise<Installed> {
  const source = sourceOf(text);
  if (!source) {
    return { ok: false, reason: `${text} is not a source: use github:owner/repo[@tag] or an npm package name[@version]` };
  }
  const bytes = await download(source, fetch);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const files = unpack(bytes);
  const read = bundleOf(files.get(MANIFEST_FILE)?.toString('utf8'));
  if (!read.ok) {
    return read;
  }
  const { manifest, main } = read.bundle;
  if (!files.has(main)) {
    return { ok: false, reason: `the archive has no ${main}` };
  }

  const registry = readRegistry(root);
  const held = registry.installed[manifest.id];
  const same = held?.version === manifest.version;
  if (same && held.sha256 !== sha256) {
    return { ok: false, reason: `${manifest.id}@${manifest.version} changed since it was installed: publish a new version instead` };
  }
  if (!same && !(await approve({ id: manifest.id, name: manifest.name, version: manifest.version, words: wordsOf(manifest) }))) {
    return { ok: false, reason: 'not approved' };
  }

  await write(join(root, manifest.id, manifest.version), files);
  writeRegistry(root, { ...registry, installed: { ...registry.installed, [manifest.id]: { version: manifest.version, source: text, sha256, permissions: permissionsOf(manifest) } } });
  return { ok: true, id: manifest.id, version: manifest.version };
}

export async function installPlugin(deps: InstallDeps, text: string): Promise<Installed> {
  try {
    return await install(deps, text);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

export async function removePlugin(root: string, id: string): Promise<Outcome> {
  const registry = readRegistry(root);
  if (!registry.installed[id]) {
    return { ok: false, reason: `${id} is not installed` };
  }
  const { [id]: _gone, ...installed } = registry.installed;
  writeRegistry(root, { installed, disabled: registry.disabled.filter((one) => one !== id) });
  await rm(join(root, id), { recursive: true, force: true });
  return { ok: true };
}
