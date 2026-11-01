import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import type { E2eSession } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { MotionComp } from '@feega/motion-core/motion/doc';
import { compBox, reframed, type Size } from '../../../src/lib/motion/comp-frame';
import { SETTLE_MS, frameDoc, frameHost, openCanvas, seedFrame } from './seed';

const SITE = process.env.DEMO_SITE ?? 'stripe.com';
const SHOTS = process.env.EVIDENCE_DIR;
const IMPORT_MS = 330_000;
const LOOK_MS = 2200;
const COMPONENTS_PAGE = 'Components';
const HOVER = 'Hover';

type Doc = { width: number; height: number; comps: Record<string, { component?: { name?: string; variant?: Record<string, string>; home?: string } }>; tracks: { clips: { component: string; props: Record<string, unknown> }[] }[] };

async function hoverableSet(admin: SupabaseClient, session: E2eSession): Promise<{ nodeId: string; doc: Doc; mainId: string }> {
  const { data: canvas } = await admin.from('canvases').select('id').eq('project_id', session.projectId).eq('name', COMPONENTS_PAGE).single();
  const { data: nodes } = await admin.from('nodes').select('id').eq('canvas_id', canvas!.id).is('deleted_at', null);
  for (const { id } of nodes ?? []) {
    const { data: head } = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
    const doc = head?.doc as Doc | undefined;
    const variants = doc ? Object.values(doc.comps).flatMap((c) => (c.component?.variant ? [c.component.variant] : [])) : [];
    const same = (a: Record<string, string>, b: Record<string, string>) => Object.keys({ ...a, ...b }).every((k) => a[k] === b[k]);
    const main = doc && Object.entries(doc.comps).find(([, c]) => {
      const v = c.component?.variant;
      return v?.State && v.State !== HOVER && variants.some((w) => same(w, { ...v, State: HOVER }));
    });
    if (doc && main) {
      return { nodeId: id, doc, mainId: main[0] };
    }
  }
  throw new Error('no set with a Hover variant on the Components page');
}

const DEMO = { width: 1920, height: 1080 };

function centred(comp: MotionComp, from: Size): MotionComp {
  const box = compBox(comp, from);
  const shift = box ? { x: DEMO.width / 2 - (box.left + box.right) / 2, y: DEMO.height / 2 - (box.top + box.bottom) / 2 } : { x: 0, y: 0 };
  return reframed(comp, from, DEMO, shift);
}

function instanceFrame(set: { nodeId: string; doc: Doc; mainId: string }) {
  const from = { width: set.doc.width, height: set.doc.height };
  const comps = Object.fromEntries(
    Object.entries(set.doc.comps).map(([id, c]) => [id, c.component ? { ...centred(c as MotionComp, from), component: { ...c.component, home: set.nodeId } } : reframed(c as MotionComp, from, DEMO)])
  );
  const instance = { id: 'cta', from: 0, durationInFrames: 150, component: 'Precomp', props: { comp: set.mainId } };
  const { tracks: _tracks, width: _w, height: _h, ...carried } = set.doc;
  return frameDoc([instance], { ...carried, background: 'brand', still: { frame: 0 }, durationInFrames: 150, comps });
}

const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
};

test('components page', async ({ page, session, admin, seedNode }) => {
  test.setTimeout(1_200_000);
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'components-page', title: 'Components page' }, async (d) => {
    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByText('From URL…'));
    await d.type(page.getByTestId('url-import-url'), SITE);
    await d.click(page.getByTestId('url-import-run'));
    await d.skip(() => expect(page.getByTestId('url-import-dialog')).toBeHidden({ timeout: IMPORT_MS }));
    await d.wait(SETTLE_MS);
    await shot(page, '1-page');

    await d.click(page.getByTestId('frame-settings').locator('summary'));
    const variables = page.getByTestId('variables-library');
    await variables.scrollIntoViewIfNeeded();
    await d.move(variables);
    await d.wait(LOOK_MS);
    await shot(page, '2-variables');

    await d.click(page.locator('nav[data-dock="left-bar"] button').first());
    const toggle = page.getByTestId('pages-toggle');
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await d.click(toggle);
    }
    await d.click(page.locator('.page-link', { hasText: COMPONENTS_PAGE }));
    await expect(page.getByTestId('component-set-outline').first()).toBeVisible({ timeout: 60_000 });
    await d.wait(SETTLE_MS);
    await d.key('Shift+Digit1', '⇧1');
    await d.wait(LOOK_MS);
    await shot(page, '3-components-page');

    const plus = page.getByTestId('component-set-plus').first();
    const set = (await page.getByTestId('component-set-outline').first().boundingBox())!;
    await d.click(plus);
    await d.click({ x: set.x + set.width / 2, y: set.y + set.height / 2 });
    await d.key('Shift+Digit2', '⇧2');
    await d.wait(LOOK_MS);
    await shot(page, '4-variant-added');

    const hoverable = await hoverableSet(admin, session);
    const frameId = await seedFrame(seedNode, admin, session, { x: -2400, y: 0 }, instanceFrame(hoverable));
    await d.click(page.locator('.page-link').first());
    await expect(frameHost(page, frameId)).toBeVisible({ timeout: 30_000 });
    await d.wait(SETTLE_MS);
    await d.key('Shift+Digit1', '⇧1');
    await d.wait(SETTLE_MS);

    const far = (await frameHost(page, frameId).boundingBox())!;
    await d.click({ x: far.x + far.width / 2, y: far.y + far.height / 2 });
    await d.key('Shift+Digit2', '⇧2');
    await d.wait(SETTLE_MS);
    const box = (await frameHost(page, frameId).boundingBox())!;
    await d.click({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await expect(page.getByTestId('instance-variant').first()).toBeVisible({ timeout: 15_000 });
    const chips = page.getByTestId('instance-variant-chips');
    const state = page.locator('label.field', { hasText: 'State' }).getByTestId('instance-variant');
    if (await chips.isVisible()) {
      await d.click(page.getByTestId('instance-variant-chip').filter({ hasText: HOVER }).first());
    } else {
      await d.select(state, HOVER);
    }
    await d.wait(LOOK_MS);
    await shot(page, '5-variant-switch');
    if (await chips.isVisible()) {
      await d.click(page.getByTestId('instance-variant-chip').first());
    } else {
      await d.select(state, 'Default');
    }
    await d.wait(1200);

    await d.key('Escape');
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.click(page.getByTestId('frame-settings').locator('summary'));
    await page.getByTestId('flow-start').scrollIntoViewIfNeeded();
    await d.click(page.getByTestId('flow-start'));
    await page.getByTestId('prototype-play').scrollIntoViewIfNeeded();
    await d.click(page.getByTestId('prototype-play'));
    await expect(page.getByTestId('prototype-player')).toBeVisible({ timeout: 15_000 });
    await d.wait(SETTLE_MS);
    const spot = page.getByTestId('state-spot').first();
    await d.move(spot);
    await d.wait(LOOK_MS);
    await shot(page, '6-player-hover');
    const spotBox = (await spot.boundingBox())!;
    await d.move({ x: spotBox.x + spotBox.width + 160, y: spotBox.y + spotBox.height + 120 });
    await d.wait(1200);
    await d.move(spot);
    await d.wait(LOOK_MS);
  });
});
