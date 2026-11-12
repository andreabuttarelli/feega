import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';
import { signInE2e } from './fixtures/session';

const PROJECT = process.env.FRESH_PROJECT_ID;
const DOC_FROM = process.env.FRESH_DOC_FROM;
const DOC_EDIT = process.env.FRESH_DOC_EDIT;
const EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 15_000;
const SAMPLE_MS = 100;
const WATCH_MS = 30_000;
const SAME = 4;

test.use({ viewport: VIEWPORT, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

const headOf = async (db: SupabaseClient, nodeId: string) =>
  (await db.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1).single().throwOnError()).data!.doc;

async function teammate() {
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const signed = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signed.error) {
    throw signed.error;
  }
  const actor = { actor_kind: 'user', actor_id: signed.data.user!.id };
  const { data: project } = await db.from('projects').select('org_id').eq('id', PROJECT!).single().throwOnError();
  const orgId = project!.org_id as string;
  const { data: source } = await db.from('nodes').select('width, height, data').eq('id', DOC_FROM!).single().throwOnError();
  const [before, after] = await Promise.all([headOf(db, DOC_FROM!), headOf(db, DOC_EDIT!)]);
  const canvasId = randomUUID();
  const nodeId = randomUUID();
  const data = { ...(source!.data as object), docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

  await db.from('canvases').insert({ id: canvasId, org_id: orgId, project_id: PROJECT!, name: 'Cache freshness probe' }).throwOnError();
  await db.from('nodes').insert({ id: nodeId, org_id: orgId, project_id: PROJECT!, canvas_id: canvasId, type: 'motion', display_name: 'Probe', x: 0, y: 0, width: source!.width, height: source!.height, data, ...actor }).throwOnError();
  await db.from('motion_revisions').insert({ org_id: orgId, node_id: nodeId, version: 1, doc: before, summary: 'seed', ...actor }).throwOnError();

  return {
    path: `/p/${PROJECT}/c/${canvasId}`,
    edit: async () => {
      await db.from('motion_revisions').insert({ org_id: orgId, node_id: nodeId, version: 2, doc: after, summary: 'teammate edit', ...actor }).throwOnError();
      await db.from('nodes').update({ data: { ...data, docHeadRevision: 2 } }).eq('id', nodeId).throwOnError();
    },
    remove: async () => {
      const at = new Date().toISOString();
      await db.from('nodes').update({ deleted_at: at }).eq('id', nodeId);
      await db.from('canvases').update({ deleted_at: at }).eq('id', canvasId);
    }
  };
}

const pixels = async (page: Page) => (await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true })).data;

function distance(a: Buffer, b: Buffer): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

test.describe('a reopened canvas never shows an outdated frame @real', () => {
  test.skip(!PROJECT || !DOC_FROM || !DOC_EDIT || !EMAIL, 'needs FRESH_PROJECT_ID, FRESH_DOC_FROM, FRESH_DOC_EDIT and E2E_TEST_EMAIL/E2E_TEST_PASSWORD');
  test.setTimeout(240_000);

  test('client A reopens after client B edits a frame and shows B version, never its cached one', async ({ page, browser }) => {
    const b = await teammate();
    const fresh = await browser.newContext({ viewport: VIEWPORT });
    const witness = await fresh.newPage();
    try {
      await signInE2e(page, { email: EMAIL, password: PASSWORD });
      await signInE2e(witness, { email: EMAIL, password: PASSWORD });
      await page.goto(b.path);
      await page.waitForTimeout(SETTLE_MS);
      const old = await pixels(page);

      await page.goto(`/p/${PROJECT}`);
      await b.edit();
      await witness.goto(b.path);
      await witness.waitForTimeout(SETTLE_MS);
      const edited = await pixels(witness);
      expect(distance(old, edited)).toBeGreaterThan(1);

      const asked: string[] = [];
      page.on('request', (r) => r.url().includes('/source') && asked.push(r.url()));
      await page.goto(b.path);
      const seen: number[] = [];
      const started = Date.now();
      while (Date.now() - started < WATCH_MS && seen.slice(-SAME).filter((d) => d < 1).length < SAME) {
        const now = await pixels(page);
        const nearOld = distance(now, old) < distance(now, edited) && distance(now, old) < 1;
        expect(nearOld, 'A drew its cached version').toBe(false);
        seen.push(distance(now, edited));
        await page.waitForTimeout(SAMPLE_MS);
      }

      expect(seen.at(-1)!).toBeLessThan(1);
      expect(asked.some((u) => /revision=2|at=2/.test(u))).toBe(true);
    } finally {
      await fresh.close();
      await b.remove();
    }
  });
});
