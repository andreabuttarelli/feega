import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { test, expect, ON_PRODUCTION, gotoHydrated, type E2eSession } from './fixtures/session';
import { PROVIDER_LOG, type RecordedRequest } from './fixtures/recording-proxy';

const PAID = process.env.E2E_PAID === '1';
const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR ?? `${homedir()}/Documents/feega-videos/demo-check`;
const SPEND_CAP_USD = Number(process.env.E2E_PAID_CAP_USD ?? '8');

const TEXT_MODEL = 'google/gemini-2.5-flash';
const IMAGE_MODEL = 'tencent/hy-image-v3.5-preview';
const VIDEO_MODEL = 'x-ai/grok-imagine-video-1.5-lite';
const VIDEO_PARAMS = { aspectRatio: '16:9', resolution: '480p', duration: 5 };

const IMAGE_MS = 180_000;
const VIDEO_MS = 600_000;
const MEDIA_BUCKETS = ['brand-knowledge', 'canvas-assets'];
const MIN_IMAGE_BYTES = 5_000;
const MIN_VIDEO_BYTES = 20_000;
const MP4_BRAND = 'ftyp';
const LIT_PIXEL = 24;
const MIN_LIT_SHARE = 0.2;

type Seed = (s: { type: string; x?: number; y?: number; data?: Record<string, unknown> }) => Promise<{ id: string }>;
type Asset = { id: string; url: string | null; type: string; content: string | null; bytes: number | null };

const canvasOf = (s: E2eSession) => `/p/${s.projectId}/c/${s.canvasId}`;

async function spentUsd(admin: SupabaseClient, session: E2eSession): Promise<number> {
  const { data: nodes } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId);
  const ids = (nodes ?? []).map((n) => n.id);
  const [{ data: calls }, { data: runs }] = await Promise.all([
    admin.from('ai_calls').select('cost_usd, node_run_id').in('node_id', ids),
    admin.from('node_runs').select('id, cost_usd').in('node_id', ids)
  ]);
  const logged = new Set((calls ?? []).map((c) => c.node_run_id));
  const data = [...(calls ?? []), ...(runs ?? []).filter((r) => !logged.has(r.id))];
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}

async function generate(page: Page, nodeId: string) {
  const node = page.locator(`[data-id="${nodeId}"]`);
  await node.click();
  await node.getByRole('button', { name: /^Generate/ }).click();
}

async function landedAsset(admin: SupabaseClient, nodeId: string, timeout: number): Promise<Asset> {
  let refId: string | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin.from('nodes').select('data').eq('id', nodeId).single();
        const shown = data?.data as { refId?: string; error?: string | null } | undefined;
        if (shown?.error) {
          return `error: ${shown.error}`;
        }
        refId = shown?.refId ?? null;
        return refId ? 'landed' : 'waiting';
      },
      { timeout, intervals: [3_000] }
    )
    .toBe('landed');
  const { data } = await admin.from('assets').select('id, url, type, content, bytes').eq('id', refId!).single();
  return data as Asset;
}

async function download(admin: SupabaseClient, path: string): Promise<Buffer> {
  if (/^https?:\/\//.test(path)) {
    return Buffer.from(await (await fetch(path)).arrayBuffer());
  }
  for (const bucket of MEDIA_BUCKETS) {
    const { data } = await admin.storage.from(bucket).download(path);
    if (data) {
      return Buffer.from(await data.arrayBuffer());
    }
  }
  throw new Error(`no bucket holds ${path}`);
}

function keep(name: string, bytes: Buffer) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const extension = bytes.subarray(4, 8).toString('latin1') === MP4_BRAND ? 'mp4' : 'png';
  writeFileSync(`${EVIDENCE_DIR}/${name}.${extension}`, bytes);
}

async function connect(page: Page, source: string, target: string, targetHandle?: string) {
  const ok = await page.evaluate(
    async ({ source, target, targetHandle }) => {
      const body = new FormData();
      body.set('source_node_id', source);
      body.set('target_node_id', target);
      body.set('kind', 'derives_from');
      if (targetHandle) {
        body.set('target_handle', targetHandle);
      }
      const res = await fetch(`${location.pathname}?/connect`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
      return (await res.json()).type === 'success';
    },
    { source, target, targetHandle }
  );
  expect(ok, `connect ${source} → ${target}`).toBe(true);
}

function providerRequests(path: RegExp): RecordedRequest[] {
  return readFileSync(PROVIDER_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RecordedRequest)
    .filter((r) => r.method === 'POST' && path.test(r.path));
}

type ReferenceBody = { input_references?: { image_url?: { url?: string } }[]; frame_images?: { image_url?: { url?: string } }[] };

function referencesIn(body: unknown): string[] {
  const sent = (body ?? {}) as ReferenceBody;
  return [...(sent.input_references ?? []), ...(sent.frame_images ?? [])].map((r) => r.image_url?.url ?? '').filter(Boolean);
}

async function referenceBytes(url: string): Promise<Buffer> {
  const inline = /^data:[^;]+;base64,(.+)$/.exec(url);
  return inline ? Buffer.from(inline[1], 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function sameImage(a: Buffer, b: Buffer): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map((img) => sharp(img).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer()));
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) {
    diff += Math.abs(x[i] - y[i]);
  }
  return diff / x.length < 8;
}

async function litShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.max(data[i], data[i + 1], data[i + 2]) > LIT_PIXEL) {
      lit += 1;
    }
  }
  return lit / (data.length / info.channels);
}

async function imageNode(seedNode: Seed, prompt: string, at = { x: 0, y: 0 }) {
  return seedNode({ type: 'image', ...at, data: { prompt, model: IMAGE_MODEL, params: { aspectRatio: '1:1' } } });
}

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } });

test.describe('demo generation @real @paid', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  test.skip(!PAID || !ON_PRODUCTION, 'runs only on demand: E2E_REAL_STACK=1 E2E_PAID=1 against the test account');

  let spent = 0;

  test.beforeEach(() => {
    expect(spent, `spend cap $${SPEND_CAP_USD} reached`).toBeLessThan(SPEND_CAP_USD);
  });

  test.afterEach(async ({ admin, session }, info) => {
    const usd = await spentUsd(admin, session);
    spent += usd;
    info.annotations.push({ type: 'spend', description: `$${usd.toFixed(4)} (total $${spent.toFixed(4)})` });
    console.log(`[spend] ${info.title}: $${usd.toFixed(4)} — total $${spent.toFixed(4)}`);
  });

  test('text node: a prompt produces text on the node', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'text', data: { prompt: 'Write one short tagline for a coffee brand.', model: TEXT_MODEL } });
    await gotoHydrated(page, canvasOf(session));
    await generate(page, node.id);

    await expect(page.locator(`[data-id="${node.id}"] .gen-text`)).not.toBeEmpty({ timeout: 90_000 });
    const asset = await landedAsset(admin, node.id, 30_000);
    expect(asset.content?.trim().length).toBeGreaterThan(3);
    console.log(`[evidence] text asset ${asset.id}: ${asset.content?.slice(0, 80)}`);
  });

  test('image node: a prompt produces an image stored in storage', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(IMAGE_MS + 60_000);
    const node = await imageNode(seedNode, 'A single red apple on a white table, studio light.');
    await gotoHydrated(page, canvasOf(session));
    await generate(page, node.id);

    const asset = await landedAsset(admin, node.id, IMAGE_MS);
    const bytes = await download(admin, asset.url!);
    const meta = await sharp(bytes).metadata();
    keep('image-node', bytes);
    expect(bytes.length).toBeGreaterThan(MIN_IMAGE_BYTES);
    expect(meta.width).toBeGreaterThan(64);
    await expect(page.locator(`[data-id="${node.id}"] img`).first()).toBeVisible({ timeout: 30_000 });
    console.log(`[evidence] image asset ${asset.id} ${asset.url} ${bytes.length} B ${meta.width}x${meta.height}`);
  });

  test('reference image: a connected image reaches the provider and shapes the output', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(2 * IMAGE_MS + 60_000);
    const source = await imageNode(seedNode, 'A bright yellow rubber duck, plain blue background.');
    const target = await imageNode(seedNode, 'The same object from the reference, now wearing a tiny black top hat.', { x: 600, y: 0 });
    await gotoHydrated(page, canvasOf(session));
    await generate(page, source.id);
    const reference = await landedAsset(admin, source.id, IMAGE_MS);

    await connect(page, source.id, target.id);
    const before = providerRequests(/\/images$/).length;
    await generate(page, target.id);
    const asset = await landedAsset(admin, target.id, IMAGE_MS);

    const sent = providerRequests(/\/images$/).slice(before);
    expect(sent).toHaveLength(1);
    const refs = referencesIn(sent[0].body);
    expect(refs).toHaveLength(1);
    expect(await sameImage(await referenceBytes(refs[0]), await download(admin, reference.url!)), 'the provider got the connected image').toBe(true);
    const bytes = await download(admin, asset.url!);
    keep('reference-in', await download(admin, reference.url!));
    keep('reference-out', bytes);
    expect(bytes.length).toBeGreaterThan(MIN_IMAGE_BYTES);
    console.log(`[evidence] reference ${reference.id} → output ${asset.id} (${bytes.length} B), provider got ${refs.length} url(s)`);
  });

  test('influencer: catalogue images reach the provider as references', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(IMAGE_MS + 60_000);
    const { data: influencer } = await admin.from('influencers').select('id, name').is('org_id', null).limit(1).single();
    expect(influencer, 'the global influencer catalogue is empty').not.toBeNull();
    const person = await seedNode({ type: 'influencer', data: { influencer_id: influencer!.id } });
    const target = await imageNode(seedNode, 'This person smiling in a sunny park, portrait photo.', { x: 600, y: 0 });
    await gotoHydrated(page, canvasOf(session));

    await connect(page, person.id, target.id);
    const before = providerRequests(/\/images$/).length;
    await generate(page, target.id);
    const asset = await landedAsset(admin, target.id, IMAGE_MS);

    const sent = providerRequests(/\/images$/).slice(before);
    const refs = referencesIn(sent[0]?.body);
    expect(refs.length, 'influencer views sent as references').toBeGreaterThan(0);
    for (const url of refs) {
      expect((await referenceBytes(url)).length, `reference ${url.slice(0, 60)} carries an image`).toBeGreaterThan(MIN_IMAGE_BYTES);
    }
    keep('influencer-in', await referenceBytes(refs[0]));
    const bytes = await download(admin, asset.url!);
    keep('influencer-out', bytes);
    expect(bytes.length).toBeGreaterThan(MIN_IMAGE_BYTES);
    console.log(`[evidence] influencer ${influencer!.name} ${influencer!.id}: ${refs.length} ref(s) → ${asset.id} (${bytes.length} B)`);
  });

  test('video node: text-to-video and image-to-video land a playable mp4', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(2 * VIDEO_MS + IMAGE_MS);
    const still = await imageNode(seedNode, 'A paper boat on a calm lake at sunrise.');
    const fromText = await seedNode({ type: 'video', x: 0, y: 600, data: { prompt: 'Waves rolling onto a beach, slow pan.', model: VIDEO_MODEL, params: VIDEO_PARAMS } });
    const fromImage = await seedNode({ type: 'video', x: 600, y: 0, data: { prompt: 'The boat drifts gently, ripples spread.', model: VIDEO_MODEL, params: VIDEO_PARAMS } });
    await gotoHydrated(page, canvasOf(session));

    await generate(page, still.id);
    const frame = await landedAsset(admin, still.id, IMAGE_MS);
    keep('video-start-frame', await download(admin, frame.url!));
    await connect(page, still.id, fromImage.id, 'first_frame');
    const before = providerRequests(/\/videos/).length;
    await generate(page, fromText.id);
    await generate(page, fromImage.id);

    for (const node of [fromText, fromImage]) {
      const asset = await landedAsset(admin, node.id, VIDEO_MS);
      const bytes = await download(admin, asset.url!);
      expect(bytes.length).toBeGreaterThan(MIN_VIDEO_BYTES);
      expect(bytes.subarray(4, 8).toString('latin1')).toBe(MP4_BRAND);
      keep(node.id === fromText.id ? 'video-t2v' : 'video-i2v', bytes);
      console.log(`[evidence] video ${node.id === fromText.id ? 't2v' : 'i2v'} asset ${asset.id} ${bytes.length} B`);
    }
    const imageToVideo = providerRequests(/\/videos/).slice(before).find((r) => JSON.stringify(r.body).includes('boat drifts'));
    const frames = referencesIn(imageToVideo?.body);
    expect(frames.length, `start frame sent: ${JSON.stringify(imageToVideo?.body ?? null).slice(0, 300)}`).toBeGreaterThan(0);
    expect(await sameImage(await referenceBytes(frames[0]), await download(admin, frame.url!))).toBe(true);

    const player = page.locator(`[data-id="${fromImage.id}"] video`).first();
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  });

  test('placing outputs: empty canvas makes a free element, a frame makes a clip, neither is black', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(IMAGE_MS + 120_000);
    const gen = await imageNode(seedNode, 'A vivid orange sunflower, flat bright background.', { x: 80, y: 520 });
    const frameNode = await seedNode({ type: 'motion', x: 700, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const blank = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frameNode.id, version: 1, doc: blank, actor_kind: 'user', actor_id: session.userId });
    await gotoHydrated(page, canvasOf(session));
    await generate(page, gen.id);
    const asset = await landedAsset(admin, gen.id, IMAGE_MS);

    await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();
    await page.getByTestId('drag-to-frame').dragTo(page.locator(`[data-motion-node="${frameNode.id}"] [data-frame-stage]`));
    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frameNode.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { component: string; props: { assetId?: string } }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).map((c) => [c.component, c.props.assetId]) ?? [];
      }, { timeout: 15_000 })
      .toEqual([['Image', asset.id]]);

    const viewport = page.viewportSize()!;
    await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();
    await page.getByTestId('drag-to-frame').dragTo(page.locator('.svelte-flow__pane'), { targetPosition: { x: viewport.width / 2, y: 60 } });
    const free = async () => ((await admin.from('nodes').select('id, data').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? []).filter((n) => (n.data as { kind?: string }).kind === 'element');
    await expect.poll(async () => (await free()).length, { timeout: 15_000 }).toBe(1);
    const element = (await free())[0];

    for (const id of [element.id, frameNode.id]) {
      const stage = page.locator(`[data-motion-node="${id}"]`);
      await expect(stage).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3_000);
      const share = await litShare(await stage.screenshot());
      console.log(`[evidence] ${id === element.id ? 'free element' : 'frame clip'} ${id}: ${(share * 100).toFixed(0)}% lit pixels`);
      expect(share, `${id} renders mostly black`).toBeGreaterThan(MIN_LIT_SHARE);
    }
  });
});
