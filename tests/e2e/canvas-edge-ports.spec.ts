import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const TOLERANCE_PX = 2;
const PORT_SQUARE_PX = 10;
const SHOTS = `${homedir()}/Documents/feega-videos/edge-ports`;
const KEYED_PROVIDER = /^(wiro|kie|higgsfield)\//;

type Point = { x: number; y: number };

const edgeEnds = (page: Page) =>
  page.locator('.svelte-flow__edge path.svelte-flow__edge-path').first().evaluate((el): Point[] => {
    const path = el as SVGPathElement;
    return [0, path.getTotalLength()].map((at) => {
      const point = path.getPointAtLength(at);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!);
      return { x: screen.x, y: screen.y };
    });
  });

async function squareEdge(page: Page, selector: string, side: 'in' | 'out'): Promise<Point> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`${selector} not rendered`);
  }
  const x = side === 'in' ? box.x + box.width - PORT_SQUARE_PX : box.x + PORT_SQUARE_PX;
  return { x, y: box.y + box.height / 2 };
}

const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

async function expectEdgeOnPorts(page: Page, sourceId: string, targetId: string) {
  await expect
    .poll(async () => {
      const [start, end] = await edgeEnds(page);
      const output = await squareEdge(page, `.svelte-flow__node[data-id="${sourceId}"] .svelte-flow__handle.port-out`, 'out');
      const input = await squareEdge(page, `.svelte-flow__node[data-id="${targetId}"] .svelte-flow__handle.port-in[data-handleid="text"]`, 'in');
      return Math.max(distance(start, output), distance(end, input));
    })
    .toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe('edges end on the port square @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test('before and after a model change moves the ports', async ({ page, session, seedNode, admin }) => {
    const { data: rows } = await admin.from('ai_models').select('id, input_modalities, uncensored, wire_spec').eq('catalogue', 'image').eq('uncensored', false);
    const models = (rows ?? []).filter((m) => !KEYED_PROVIDER.test(m.id) && !m.wire_spec?.unrunnable && !m.wire_spec?.discountFor);
    const textOnly = models.find((m) => m.input_modalities.includes('text') && !m.input_modalities.includes('image'));
    const withImages = models.find((m) => m.input_modalities.includes('text') && m.input_modalities.includes('image'));
    expect(textOnly && withImages, 'catalogue has a text-only and a text+image image model').toBeTruthy();

    const source = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'A lighthouse.' } });
    const target = await seedNode({ type: 'image', x: 520, y: 0, data: { prompt: 'It at dusk.', model: textOnly!.id } });
    const edge = await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: source.id, target_node_id: target.id, target_handle: 'text', actor_kind: 'user', actor_id: session.userId });
    expect(edge.error).toBeNull();

    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const ports = page.locator(`.svelte-flow__node[data-id="${target.id}"] .svelte-flow__handle.port-in`);
    await expect(ports).toHaveCount(1);
    await page.locator(`.svelte-flow__node[data-id="${target.id}"]`).click({ position: { x: 24, y: 12 } });
    await expectEdgeOnPorts(page, source.id, target.id);
    await page.screenshot({ path: `${SHOTS}/before.png` });

    const update = await admin.from('nodes').update({ data: { prompt: 'It at dusk.', model: withImages!.id } }).eq('id', target.id);
    expect(update.error).toBeNull();
    await expect(ports).toHaveCount(2);
    await expectEdgeOnPorts(page, source.id, target.id);
    await page.screenshot({ path: `${SHOTS}/after.png` });
  });
});
