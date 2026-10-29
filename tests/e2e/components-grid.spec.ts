import { homedir } from 'node:os';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/editor-modes`;
const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SCHEMES = ['light', 'dark'] as const;

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const id = () => `grid${++n}`;

function landing(): MotionDoc {
  const hero = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fill: '#0b1020' } }, 'hero'));
  const pill = must(addClip(hero, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.3, y: 0.7, width: 0.2, height: 0.09, corners: [0.5], fill: '#5b5bf7' } }, 'pill'));
  const label = must(addClip(pill, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Start free trial', size: 0.035, x: 0.3, y: 0.7, width: 0.2, height: 0.09, color: '#ffffff' } }, 'label'));
  const title = must(addClip(label, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Ship faster', size: 0.1, x: 0.5, y: 0.35, width: 0.8, height: 0.2, color: '#ffffff' } }, 'title'));
  const badge = must(addClip(title, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'ellipse', x: 0.8, y: 0.72, width: 0.08, height: 0.14, fill: '#ffb020' } }, 'badge'));
  const withButton = must(createComponent(badge, ['pill', 'label'], id, 'Button'));
  const withTitle = must(createComponent(withButton, ['title'], id, 'Headline'));
  return must(createComponent(withTitle, ['badge'], id, 'Badge'));
}

test.describe('the components grid @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('shows a tile per component with a preview of the component itself', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: landing(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByRole('button', { name: 'Components', exact: true }).first().click();

      await expect(page.getByTestId('component-row')).toHaveCount(3, { timeout: 20_000 });
      await expect(page.locator('[data-testid="component-preview"] canvas.drawn')).toHaveCount(3, { timeout: 30_000 });
      await page.screenshot({ path: `${SHOTS}/components-grid-${scheme}.png` });
      await page.getByTestId('project-components').screenshot({ path: `${SHOTS}/components-grid-${scheme}-panel.png` });
    }
  });
});
