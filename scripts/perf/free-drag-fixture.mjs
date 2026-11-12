import { writeFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';

const PROJECT_ID = '00000000-0000-4000-8000-0000000fd001';
const CANVAS_ID = '00000000-0000-4000-8000-0000000fd002';
const EXPORTED_AT = '2026-11-12T00:00:00.000Z';
const SIDE = 400;

export const FREE_DRAG_PLACE = { projectId: PROJECT_ID, canvasId: CANVAS_ID };
export const FREE_DRAG_UNDER = { id: '00000000-0000-4000-8005-000000000001', x: 0, y: 0, side: SIDE, colour: '#ff0000' };
export const FREE_DRAG_OVER = { id: '00000000-0000-4000-8005-000000000002', x: 140, y: 140, side: 120, colour: '#808080' };

const shapeDoc = (shape, colour, side) => ({
  version: 5,
  fps: 30,
  width: side,
  height: side,
  durationInFrames: 150,
  background: 'transparent',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'shape', from: 0, durationInFrames: 150, component: 'Shape', props: { shape, x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: colour }] } }] }],
  comps: {},
  assets: []
});

const element = (spec, shape, z) => ({
  node: { id: spec.id, type: 'element', displayName: null, position: { x: spec.x, y: spec.y, z }, size: { width: spec.side, height: spec.side }, data: { docHeadRevision: 1 } },
  head: { version: 1, doc: shapeDoc(shape, spec.colour, spec.side) }
});

export function freeDragFixture() {
  const items = [element(FREE_DRAG_UNDER, 'rect', 0), element(FREE_DRAG_OVER, 'ellipse', 1)];
  const canvas = { nodes: items.map((i) => i.node), connections: [], heads: Object.fromEntries(items.map((i) => [i.node.id, i.head])), assets: [] };
  const manifest = { format: 'feega', version: 1, exportedAt: EXPORTED_AT, canvasName: 'free drag', source: { projectId: PROJECT_ID, canvasId: CANVAS_ID } };
  return { manifest, canvas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { manifest, canvas } = freeDragFixture();
  writeFileSync(process.argv[2], zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'canvas.json': strToU8(JSON.stringify(canvas)) }));
}
