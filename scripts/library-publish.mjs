import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'];
const TIERS = ['free', 'pro'];
const BUCKET = 'library-pro';
const DEFAULT_PREVIEW_BASE = 'https://docs.feega.app/library';
const DEFAULT_ITEMS = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'library', 'items');
const DEFAULT_OUT = '.library-publish';
const URL_VAR = 'LIBRARY_PUBLISH_SUPABASE_URL';
const KEY_VAR = 'LIBRARY_PUBLISH_SERVICE_ROLE_KEY';

function readManifest(itemsDir, id) {
  const manifest = JSON.parse(readFileSync(join(itemsDir, id, 'manifest.json'), 'utf8'));
  if (!TIERS.includes(manifest.tier)) {
    throw new Error(`${id}: tier must be one of ${TIERS.join(', ')}`);
  }
  if (!Array.isArray(manifest.frameworks) || manifest.frameworks.some((framework) => !FRAMEWORKS.includes(framework))) {
    throw new Error(`${id}: frameworks must be a list of ${FRAMEWORKS.join(', ')}`);
  }

  return manifest;
}

function filesOf(itemsDir, id, framework) {
  const dir = join(itemsDir, id, framework);
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  if (!names.length) {
    throw new Error(`${id}: no files for ${framework}`);
  }

  return names.map((path) => ({ path, content: readFileSync(join(dir, path), 'utf8') }));
}

function indexEntry(manifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    category: manifest.category,
    tags: manifest.tags,
    frameworks: manifest.frameworks,
    tier: manifest.tier,
    previewUrl: manifest.preview ?? `${DEFAULT_PREVIEW_BASE}/${manifest.id}`
  };
}

export function packLibrary(itemsDir) {
  const ids = readdirSync(itemsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const files = new Map();
  const index = [];

  for (const id of ids) {
    const manifest = readManifest(itemsDir, id);
    index.push(indexEntry(manifest));
    for (const framework of manifest.frameworks) {
      files.set(`items/${id}/${framework}.json`, JSON.stringify({ files: filesOf(itemsDir, id, framework) }));
    }
  }
  files.set('index.json', JSON.stringify(index));

  return { index, files };
}

export function uploadTarget(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${path}`;
}

function writeLocal(out, files) {
  for (const [path, content] of files) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), content);
  }
}

async function upload(baseUrl, key, files) {
  for (const [path, content] of files) {
    const res = await fetch(uploadTarget(baseUrl, path), {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-upsert': 'true' },
      body: content
    });
    if (!res.ok) {
      throw new Error(`upload ${path} failed: ${res.status}`);
    }
  }
}

function option(args, name, fallback) {
  const at = args.indexOf(name);

  return at === -1 ? fallback : args[at + 1];
}

export async function main(args, env) {
  const { files } = packLibrary(option(args, '--items', DEFAULT_ITEMS));

  if (args.includes('--dry-run')) {
    writeLocal(option(args, '--out', DEFAULT_OUT), files);

    return;
  }

  const baseUrl = env[URL_VAR];
  const key = env[KEY_VAR];
  if (!baseUrl || !key) {
    throw new Error(`Set ${URL_VAR} and ${KEY_VAR} to upload, or pass --dry-run`);
  }

  await upload(baseUrl, key, files);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
