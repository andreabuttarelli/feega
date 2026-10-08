import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { releaseGalleryItem } from '$lib/server/repos/gallery';
import { publishFile, removeGalleryFiles } from '$lib/server/gallery/files';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { applyValues } from '$lib/motion/template/fields';
import { FieldType } from '$lib/motion/template/field-model';
import { parseMotionDoc, type AssetRef, type MotionDoc } from '$lib/motion/doc';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { factsOf, FEEGA_AUTHOR, GalleryStatus, swapAssetIds, type GalleryAsset } from '$lib/gallery/model';
import { publishRefusal } from '$lib/gallery/refusals';
import { ProjectMode } from '$lib/project-mode';

export const SEED_NAMESPACE = 'feega-gallery';
const ORG_SLUG = 'feega';
const SYSTEM_EMAIL = process.env.GALLERY_SYSTEM_EMAIL ?? 'gallery@feega.app';
const SOURCE_DIR = resolve(process.env.FEEGA_VIDEOS_DIR ?? join(homedir(), 'Documents/feega-videos'));
const REPO = resolve(import.meta.dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const OUT_FLAG = '--out';
const ORG_FLAG = '--org';
const POSTER_SHARE = 0.4;
const STILL_WIDTH = 1280;
const SAMPLE_CARDS = 8;

const MIME: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.html': 'text/html'
};

export type Seed = {
  key: string;
  title: string;
  description: string;
  tags: string[];
  doc: MotionDoc;
  files: Record<string, string>;
  preview: string | null;
};

type DemoSource = Omit<Seed, 'doc' | 'files' | 'preview'> & { doc: string; files: Record<string, string>; preview: string };

export const DEMOS: readonly DemoSource[] = [
  {
    key: 'ondrafo-launch',
    title: 'Ondrafo launch film',
    description: 'A four-act launch for an invented website builder: the problem, the product, the proof and the claim, with live UI and music.',
    tags: ['launch', 'saas', 'ui'],
    doc: 'generic-sites/doc.json',
    files: { logo: 'generic-sites/logo.svg', music: 'generic-sites/music.mp3' },
    preview: 'generic-sites/launch.mp4'
  },
  {
    key: 'ondrafo-launch-v2',
    title: 'Ondrafo launch film, second cut',
    description: 'The same invented brand, recut: tighter acts, a sharper prompt-to-live flow and an outlined wordmark.',
    tags: ['launch', 'saas', 'ui'],
    doc: 'generic-sites/doc-v2.json',
    files: { logo: 'generic-sites/logo-v2.svg', music: 'generic-sites/music.mp3' },
    preview: 'generic-sites/launch-v2.mp4'
  },
  {
    key: 'liquid-glass-lens',
    title: 'Liquid glass lens',
    description: 'A glass lens slides across a headline, springs and settles on the call to action.',
    tags: ['glass', 'hero', 'text'],
    doc: 'liquid-glass/wide/doc.json',
    files: {},
    preview: 'liquid-glass/liquid-glass.mp4'
  },
  {
    key: 'liquid-glass-lens-square',
    title: 'Liquid glass lens, square',
    description: 'The glass lens hero, cut for a square feed.',
    tags: ['glass', 'hero', 'text'],
    doc: 'liquid-glass/square/doc.json',
    files: {},
    preview: 'liquid-glass/liquid-glass-1x1.mp4'
  },
  {
    key: 'liquid-glass-blob',
    title: 'Liquid glass blob',
    description: 'A soft glass blob drifts and morphs over the type, bending what is behind it.',
    tags: ['glass', 'blob', 'hero'],
    doc: 'liquid-glass-v2/wide/doc.json',
    files: {},
    preview: 'liquid-glass-v2/liquid-glass.mp4'
  },
  {
    key: 'liquid-glass-blob-square',
    title: 'Liquid glass blob, square',
    description: 'The glass blob hero, cut for a square feed.',
    tags: ['glass', 'blob', 'hero'],
    doc: 'liquid-glass-v2/square/doc.json',
    files: {},
    preview: 'liquid-glass-v2/liquid-glass-1x1.mp4'
  },
  {
    key: 'daily-loop-phones',
    title: 'Daily Loop on two phones',
    description: "Two phones turn in: today's habits on one, the weekly streak on the other, both live vector UI.",
    tags: ['device', 'app', 'ui'],
    doc: 'device-screens/doc-v2.json',
    files: {},
    preview: 'device-screens/demo-v2.mp4'
  }
];

export const EXCLUDED_DEMOS: readonly { name: string; why: string }[] = [
  { name: 'supasito', why: 'real brand' },
  { name: 'dub (build.ts at the root, fictional-launch)', why: 'real brand' },
  { name: 'allbirds', why: 'real brand' }
];

const STILLS: readonly [string, number][] = [
  ['generic-sites/launch.mp4', 5],
  ['device-screens/demo-v2.mp4', 5],
  ['liquid-glass/liquid-glass.mp4', 5],
  ['generic-sites/launch-v2.mp4', 8],
  ['liquid-glass-v2/liquid-glass.mp4', 4],
  ['generic-sites/launch.mp4', 9.5],
  ['generic-sites/launch-v2.mp4', 12],
  ['liquid-glass-v2/liquid-glass-1x1.mp4', 6]
];

const BUILTIN_TAGS: readonly [string, string[]][] = [
  ['builtin:launch-', ['launch', 'scene']],
  ['builtin:composition-', ['composition', '3d']],
  ['builtin:ui-morph', ['ui', 'reel']]
];

const SAMPLE = (n: number) => `sample-${n}`;
const LOGO_SAMPLE = 'sample-logo';

export function seedId(key: string): string {
  const hex = createHash('sha1').update(`${SEED_NAMESPACE}/${key}`).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parsed(raw: unknown, where: string): MotionDoc {
  const verdict = parseMotionDoc(raw);
  if (!verdict.ok) {
    throw new Error(`${where}: ${verdict.error}`);
  }
  return verdict.doc;
}

export function filledTemplate(doc: MotionDoc, samples: number): MotionDoc {
  const cards = Array.from({ length: Math.min(samples, SAMPLE_CARDS) }, (_, i) => SAMPLE(i));
  let picture = 0;
  const values = Object.fromEntries(
    doc.fields.flatMap((f): [string, string][] => {
      if (f.type === FieldType.MediaList) {
        return [[f.key, cards.join(',')]];
      }
      if (f.type !== FieldType.Asset) {
        return [];
      }
      return [[f.key, f.key.includes('logo') ? LOGO_SAMPLE : cards[picture++ % cards.length]]];
    })
  );
  const filled = applyValues(doc, values);
  if (!filled.ok) {
    throw new Error(filled.error);
  }
  const used = new Set(Object.values(values).flatMap((v) => v.split(',')));
  const refs: AssetRef[] = [...used].map((id) => ({ id, kind: 'image', name: id }));
  return parsed({ ...filled.doc, assets: [...filled.doc.assets.filter((a) => !used.has(a.id)), ...refs] }, 'template');
}

function stills(dir: string): Record<string, string> {
  const out: Record<string, string> = { [LOGO_SAMPLE]: join(REPO, 'logo.jpg') };
  STILLS.forEach(([video, at], i) => {
    const source = join(SOURCE_DIR, video);
    if (!existsSync(source)) {
      return;
    }
    const file = join(dir, `${SAMPLE(i)}.jpg`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', source, '-frames:v', '1', '-vf', `scale=${STILL_WIDTH}:-2`, '-q:v', '3', file]);
    out[SAMPLE(i)] = file;
  });
  return out;
}

function poster(dir: string, key: string, video: string, seconds: number): string {
  const file = join(dir, `${key}-poster.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(seconds * POSTER_SHARE), '-i', video, '-frames:v', '1', '-vf', `scale=${STILL_WIDTH}:-2`, '-q:v', '3', file]);
  return file;
}

export function builtinTitle(name: string): string {
  return name.replace(/^Launch · /, '').trim();
}

function catalogue(dir: string): { seeds: (Seed & { poster: string | null })[]; skipped: { key: string; why: string }[] } {
  const skipped: { key: string; why: string }[] = [];
  const seeds: (Seed & { poster: string | null })[] = [];

  for (const demo of DEMOS) {
    const docPath = join(SOURCE_DIR, demo.doc);
    const missing = [demo.doc, ...Object.values(demo.files)].find((f) => !existsSync(join(SOURCE_DIR, f)));
    if (missing) {
      skipped.push({ key: demo.key, why: `${missing} is missing and there is no build script that rebuilds it here` });
      continue;
    }
    const doc = parsed(JSON.parse(readFileSync(docPath, 'utf8')), demo.doc);
    const preview = existsSync(join(SOURCE_DIR, demo.preview)) ? join(SOURCE_DIR, demo.preview) : null;
    const files = Object.fromEntries(Object.entries(demo.files).map(([id, f]) => [id, join(SOURCE_DIR, f)]));
    seeds.push({ ...demo, doc, files, preview, poster: preview ? poster(dir, demo.key, preview, factsOf(doc).durationS) : null });
  }

  const samples = stills(dir);
  const sampleCount = Object.keys(samples).length - 1;
  for (const entry of BUILTIN_TEMPLATES) {
    const tags = BUILTIN_TAGS.find(([prefix]) => entry.id.startsWith(prefix))?.[1];
    if (!tags) {
      continue;
    }
    const doc = filledTemplate(entry.template.doc, sampleCount);
    const files = Object.fromEntries(doc.assets.filter((a) => samples[a.id]).map((a) => [a.id, samples[a.id]]));
    const key = entry.id.replace(/^builtin:/, 'template-');
    seeds.push({ key, title: builtinTitle(entry.template.name), description: entry.template.description, tags, doc, files, preview: null, poster: null });
  }

  return { seeds, skipped };
}

const mimeOf = (path: string) => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
const fileOf = (path: string) => ({ bytes: readFileSync(path), mime: mimeOf(path) });

function seedUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('scripts/seed-gallery.ts'));
  if (!use) {
    throw new Error('seed-gallery: missing entry in service-role-uses.ts');
  }
  return use;
}

async function systemUser(db: Db): Promise<string> {
  const admin = (db as unknown as SupabaseClient).auth.admin;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }
    const found = data.users.find((u) => u.email === SYSTEM_EMAIL);
    if (found) {
      return found.id;
    }
    if (data.users.length < 1000) {
      break;
    }
  }
  const { data, error } = await admin.createUser({ email: SYSTEM_EMAIL, password: randomUUID(), email_confirm: true, user_metadata: { name: FEEGA_AUTHOR } });
  if (error || !data.user) {
    throw error ?? new Error('createUser returned no user');
  }
  return data.user.id;
}

async function seedOrg(db: Db, userId: string, slug: string): Promise<{ id: string; name: string }> {
  const client = db as unknown as SupabaseClient;
  const found = await client.from('orgs').select('id, name').eq('slug', slug).maybeSingle();
  if (found.error) {
    throw found.error;
  }
  const org = found.data ?? (await client.from('orgs').insert({ name: FEEGA_AUTHOR, slug }).select('id, name').single()).data;
  if (!org) {
    throw new Error(`could not create the org ${slug}`);
  }
  const member = await client.from('orgs_members').select('user_id').eq('org_id', org.id).eq('user_id', userId).maybeSingle();
  if (!member.data) {
    const joined = await client.from('orgs_members').insert({ org_id: org.id, user_id: userId, role: 'owner' });
    if (joined.error) {
      throw joined.error;
    }
  }
  return org;
}

async function publish(db: Db, owner: { orgId: string; userId: string; authorName: string }, seed: Seed & { poster: string | null }): Promise<string> {
  const id = seedId(seed.key);
  const facts = factsOf(seed.doc);
  const client = db as unknown as SupabaseClient;
  const upserted = await client.from('gallery_items').upsert({
    id,
    org_id: owner.orgId,
    user_id: owner.userId,
    author_name: owner.authorName,
    title: seed.title,
    description: seed.description,
    tags: seed.tags,
    kind: facts.kind,
    format: facts.format,
    duration_s: facts.durationS,
    doc: seed.doc,
    status: GalleryStatus.Unlisted,
    actor_kind: 'system',
    actor_id: owner.userId,
    agent_key: SEED_NAMESPACE
  });
  if (upserted.error) {
    throw upserted.error;
  }

  await removeGalleryFiles(db, id);
  const ids: Record<string, string> = {};
  const assets: GalleryAsset[] = [];
  for (const ref of seed.doc.assets) {
    const path = seed.files[ref.id];
    if (!path) {
      throw new Error(`${seed.key}: no file for asset ${ref.id}`);
    }
    const assetId = randomUUID();
    ids[ref.id] = assetId;
    assets.push({ id: assetId, kind: ref.kind, name: ref.name, url: await publishFile(db, id, assetId, fileOf(path)) });
  }

  await releaseGalleryItem(db, {
    orgId: owner.orgId,
    id,
    release: {
      doc: swapAssetIds(seed.doc, ids),
      assets,
      posterUrl: seed.poster ? await publishFile(db, id, 'poster', fileOf(seed.poster)) : null,
      previewUrl: seed.preview ? await publishFile(db, id, 'preview', fileOf(seed.preview)) : null
    }
  });
  return id;
}

function argument(flag: string): string | null {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

function dryRun(seeds: (Seed & { poster: string | null })[], out: string) {
  mkdirSync(out, { recursive: true });
  const files = seeds.map((seed) => {
    const assets = Object.fromEntries(Object.entries(seed.files).map(([id, path]) => [id, `file://${path}`]));
    const file = join(out, `${seed.key}.html`);
    writeFileSync(file, composeHtml({ doc: seed.doc, tokens: FEEGA_TOKENS, assets }));
    return { key: seed.key, id: seedId(seed.key), title: seed.title, description: seed.description, tags: seed.tags, ...factsOf(seed.doc), files: seed.files, preview: seed.preview, poster: seed.poster, html: file, doc: seed.doc };
  });
  writeFileSync(join(out, 'catalogue.json'), JSON.stringify(files, null, 1));
}


const POSTER_SETTLE_MS = 1500;
const PLAYER_TIMEOUT_MS = 30_000;

async function renderPosters(dir: string, seeds: (Seed & { poster: string | null })[]): Promise<void> {
  const missing = seeds.filter((s) => !s.poster);
  if (!missing.length) {
    return;
  }
  const served = new Map<string, string>();
  const server = createServer((req, res) => {
    const path = served.get(req.url ?? '');
    if (!path) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': mimeOf(path), 'access-control-allow-origin': '*' }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    for (const seed of missing) {
      const assets = Object.fromEntries(Object.entries(seed.files).map(([id, path]) => {
        const url = `/${seed.key}/${id}${extname(path)}`;
        served.set(url, path);
        return [id, `${origin}${url}`];
      }));
      const page = `/${seed.key}.html`;
      const html = join(dir, `${seed.key}.html`);
      writeFileSync(html, composeHtml({ doc: seed.doc, tokens: FEEGA_TOKENS, assets }));
      served.set(page, html);
      const tab = await browser.newPage({ viewport: { width: seed.doc.width, height: seed.doc.height } });
      await tab.goto(`${origin}${page}`);
      await tab.waitForFunction(() => (window as unknown as { __playerReady?: boolean }).__playerReady === true, null, { timeout: PLAYER_TIMEOUT_MS });
      await tab.evaluate(async (t) => {
        const w = window as unknown as { __player: { renderSeek: (t: number) => void }; __hfWaitForSeekCompletion?: () => Promise<void> };
        w.__player.renderSeek(t);
        await w.__hfWaitForSeekCompletion?.();
      }, factsOf(seed.doc).durationS * POSTER_SHARE);
      await tab.waitForTimeout(POSTER_SETTLE_MS);
      seed.poster = join(dir, `${seed.key}-poster.jpg`);
      await tab.screenshot({ path: seed.poster, type: 'jpeg', quality: 85 });
      await tab.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'feega-gallery-seed-'));
  const { seeds, skipped } = catalogue(work);
  await renderPosters(work, seeds);

  const refused = seeds.flatMap((s) => {
    const verdict = publishRefusal({ mode: ProjectMode.Standard, hasBrand: false, doc: s.doc, siteAssetIds: new Set() });
    return verdict ? [{ key: s.key, why: verdict.message }] : [];
  });
  const ready = seeds.filter((s) => !refused.some((r) => r.key === s.key));

  console.log(`${ready.length} items ready from ${SOURCE_DIR}`);
  [...skipped, ...refused].forEach((s) => console.log(`skip ${s.key}: ${s.why}`));
  EXCLUDED_DEMOS.forEach((e) => console.log(`excluded ${e.name}: ${e.why}`));

  if (DRY_RUN) {
    const out = argument(OUT_FLAG) ?? join(work, 'html');
    dryRun(ready, out);
    ready.forEach((s) => console.log(`dry ${seedId(s.key)} ${s.key} · ${s.title}`));
    console.log(`html and catalogue.json in ${out}`);
    return;
  }

  const db = createServiceRoleDb(seedUse());
  const userId = await systemUser(db);
  const org = await seedOrg(db, userId, argument(ORG_FLAG) ?? ORG_SLUG);
  for (const seed of ready) {
    console.log(`ok ${await publish(db, { orgId: org.id, userId, authorName: org.name }, seed)} ${seed.title}`);
  }
}

if (process.env.VITEST === undefined) {
  main().catch((cause) => {
    console.error(cause);
    process.exit(1);
  });
}
