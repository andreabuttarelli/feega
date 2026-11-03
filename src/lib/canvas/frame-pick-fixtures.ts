import { Align, Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { box, DocKit } from '@feega/motion-core/motion/codegen/fixtures/kit';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { parseMotionDoc, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { withSurface } from '@feega/motion-core/motion/surface';
import { groupClips } from '$lib/motion/group';

export type PickFixture = { doc: MotionDoc; playhead?: number; turn?: number };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const parsed = (doc: MotionDoc): MotionDoc => {
  const read = parseMotionDoc(doc);
  if (!read.ok) {
    throw new Error(read.error);
  }
  return read.doc;
};

const turned = (doc: MotionDoc, degrees: Record<string, number>): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (c.id in degrees ? { ...c, props: { ...c.props, rotation: degrees[c.id] } } : c)) }))
});

function nestedInstances(): MotionDoc {
  const k = new DocKit(1200, 800);
  k.component('c-chip', 'Chip', (c) => {
    c.frame('root', { name: 'Chip', box: box(0, 0, 120, 36), fill: '#eef2ff', radius: 18, layout: { direction: Direction.Horizontal, align: Align.Center, padding: { top: 8, right: 14, bottom: 8, left: 14 } }, item: { width: Sizing.Hug, height: Sizing.Hug } });
    c.text('label', 'New', { parent: 'root', name: 'Label', size: 14, weight: 600, color: '#1f2a6b' });
  });
  k.component('c-card', 'Card', (c) => {
    c.frame('root', { name: 'Card', box: box(0, 0, 360, 240), fill: '#ffffff', radius: 16, clip: true, layout: { direction: Direction.Vertical, gap: 12, padding: { top: 24, right: 24, bottom: 24, left: 24 } }, item: { width: Sizing.Fixed, height: Sizing.Fixed } });
    c.instance('chip', 'c-chip', { parent: 'root', name: 'Chip', box: box(0, 0, 120, 36) });
    c.text('title', 'Quarterly close', { parent: 'root', name: 'Title', size: 28, weight: 600, color: '#0e1116' });
    c.text('body', 'Every account reconciled before Friday.', { parent: 'root', name: 'Body', size: 16, color: '#3d4451', box: box(0, 0, 312, 48), item: { width: Sizing.Fill, height: Sizing.Hug } });
  });
  k.frame('page', { name: 'Page', box: box(0, 0, 1200, 800), fill: '#f6f7f9', layout: { direction: Direction.Horizontal, gap: 40, padding: { top: 80, right: 80, bottom: 80, left: 80 } }, item: { width: Sizing.Fixed, height: Sizing.Fixed } });
  k.instance('card-a', 'c-card', { parent: 'page', name: 'Card A', box: box(0, 0, 360, 240) });
  k.instance('card-b', 'c-card', { parent: 'page', name: 'Card B', box: box(0, 0, 360, 240), overrides: { title: { text: 'Audit trail' } } });
  return parsed(k.doc());
}

function rotated(): MotionDoc {
  const k = new DocKit(1000, 1000);
  k.frame('panel', { name: 'Panel', box: box(200, 200, 600, 400), fill: '#e6e8ec' });
  k.frame('badge', { name: 'Badge', parent: 'panel', box: box(260, 260, 200, 120), fill: '#1f5eff' });
  k.frame('tilted', { name: 'Tilted', box: box(100, 700, 300, 160), fill: '#12b981' });
  return parsed(turned(k.doc(), { panel: 20, tilted: -35 }));
}

function clipped(): MotionDoc {
  const k = new DocKit(800, 600);
  k.frame('window', { name: 'Window', box: box(100, 100, 400, 300), fill: '#ffffff', clip: true });
  k.frame('spill', { name: 'Spill', parent: 'window', box: box(350, 250, 300, 250), fill: '#f59e0b' });
  return parsed(k.doc());
}

function grouped(): MotionDoc {
  let n = 0;
  const shape = (doc: MotionDoc, id: string, x: number, y: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x, y, width: 0.2, height: 0.2 } }, id));
  const doc = shape(shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.3, 0.4), 'b', 0.4, 0.5), 'c', 0.75, 0.5);
  return withSurface(must(groupClips(doc, ['a', 'b'], () => `g${++n}`)), 'surface');
}

function timed(): MotionDoc {
  const early = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }, 'early'));
  return must(addClip(early, { component: 'Text', from: 60, durationInFrames: 90, props: { text: 'Later', x: 0.6, y: 0.5, width: 0.3, height: 0.15, entrance: 'fade-up' } }, 'late'));
}

export const PICK_FIXTURES: Record<string, () => PickFixture> = {
  landing: () => ({ doc: parsed(landingDoc()) }),
  'landing on a phone breakpoint': () => ({ doc: resolveView(parsed(landingDoc()), 'phone') }),
  'nested instances': () => ({ doc: nestedInstances() }),
  'rotated clips': () => ({ doc: rotated() }),
  'a rotated tile': () => ({ doc: rotated(), turn: 30 }),
  'a clipped frame': () => ({ doc: clipped() }),
  'groups on a surface': () => ({ doc: grouped() }),
  'early in time': () => ({ doc: timed(), playhead: 10 }),
  'late in time': () => ({ doc: timed(), playhead: 120 })
};
