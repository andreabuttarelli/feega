import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardOverElements, elementsOnly, node, solid } from '../../../../tests/fixtures/figma/elements';
import { buttonInstances, smallTextInHugeFrame } from '../../../../tests/fixtures/figma/components';
import { figmaClipboardHtml } from '../../../../tests/fixtures/figma/clipboard';
import { HIDDEN_ICON, landingPage, OVERRIDDEN_LABEL } from '../../../../tests/fixtures/figma/landing';
import { FrameKind } from '$lib/canvas/motion-node';
import { parseMotionDoc, type MotionClip } from '@feega/motion-core/motion/doc';
import { stillFrame } from '$lib/canvas/core/frame-source';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { boxBook } from '$lib/motion/gpu-full/text/test-face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { figmaPlan, planOf } from './figma-doc';
import { Destination } from './scene';

const clip = readFileSync(new URL('../../../../tests/fixtures/figma/clip-1.html', import.meta.url), 'utf8');

let n = 0;
const newId = () => `id${++n}`;

const clipsOf = (doc: { tracks: { clips: unknown[] }[]; comps: Record<string, { tracks: { clips: unknown[] }[] }> }): MotionClip[] =>
  [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

describe('a Figma paste of one frame', () => {
  it('builds a valid frame doc the size of the copied frame', () => {
    const plan = figmaPlan(clip, newId)!;
    const [item] = plan.items;
    expect(plan.items).toHaveLength(1);
    expect(item.destination).toBe(Destination.Frame);
    expect(parseMotionDoc(item.doc).ok).toBe(true);
    expect(item.size).toEqual({ width: 1920, height: 1080 });
    expect(item.name).toBe('Cover');
  });

  it('lands the text as an editable Text clip in Archivo bold', () => {
    const doc = figmaPlan(clip, newId)!.items[0].doc;
    const text = clipsOf(doc).find((c) => c.component === 'Text');
    expect(text?.props).toMatchObject({ text: 'dal \nnulla', font: 'Archivo', weight: 700, color: '#ffffff', letterSpacing: '-7%', lineHeight: '83%' });
    expect(doc.fonts.map((f) => f.family)).toContain('Archivo');
  });

  it('lands the ghost as three even-odd vector shapes grouped, over a black background', () => {
    const clips = clipsOf(figmaPlan(clip, newId)!.items[0].doc);
    const shapes = clips.filter((c) => c.component === 'Shape');
    const fill = (c: MotionClip) => (c.props.fills as { color?: string }[])[0]?.color;
    expect(shapes.filter((s) => fill(s) === '#fd5e29' && s.props.fillRule === 'evenodd')).toHaveLength(3);
    expect(shapes.some((s) => fill(s) === '#000000')).toBe(true);
    expect(clips.some((c) => c.component === 'Precomp')).toBe(true);
  });

  it('draws its text on the canvas instead of resting before the text fades in', () => {
    const doc = figmaPlan(clip, newId)!.items[0].doc;
    const text = clipsOf(doc).find((c) => c.component === 'Text')!;
    const list = drawFrame(prepare(doc, FEEGA_TOKENS, {}, { fonts: boxBook(), smoothing: Smoothing.Plain }), stillFrame(doc));
    expect(list.items.some((i) => 'clip' in i && i.clip === text.id)).toBe(true);
  });

  it('returns null for html without Figma data', () => {
    expect(figmaPlan('<p>x</p>', newId)).toBeNull();
  });
});

describe('a Figma paste of elements only', () => {
  const plan = planOf(elementsOnly(), newId)!;

  it('makes one free element per top-level node and no frame', () => {
    expect(plan.items.map((i) => [i.destination, i.kind])).toEqual([
      [Destination.Free, FrameKind.Element],
      [Destination.Free, FrameKind.Element],
      [Destination.Free, FrameKind.Element],
      [Destination.Free, FrameKind.Group]
    ]);
    expect(plan.items.every((i) => parseMotionDoc(i.doc).ok)).toBe(true);
  });

  it('every free element is one clip on a transparent doc', () => {
    for (const item of plan.items) {
      expect(item.doc.tracks.flatMap((t) => t.clips)).toHaveLength(1);
      expect(item.doc.background).toBe('transparent');
    }
  });

  it('keeps both fills and both strokes of the rectangle', () => {
    const shape = plan.items[0].doc.tracks.flatMap((t) => t.clips)[0] as MotionClip;
    expect((shape.props.fills as unknown[]).length).toBe(2);
    expect((shape.props.strokes as unknown[]).length).toBe(2);
  });

  it('applies the rotation of the text', () => {
    const text = plan.items[2].doc.tracks.flatMap((t) => t.clips)[0] as MotionClip;
    expect(text.props.rotation).toBe(-90);
  });

  it('keeps the group as one group clip with its two rectangles inside', () => {
    const doc = plan.items[3].doc;
    expect(clipsOf(doc).filter((c) => c.component === 'Shape')).toHaveLength(2);
  });
});

describe('a Figma frame with auto layout', () => {
  const plan = planOf(cardOverElements(), newId)!;
  const card = plan.items.find((i) => i.destination === Destination.Frame)!;
  const clips = clipsOf(card.doc);

  it('becomes an auto layout container holding its children', () => {
    const container = clips.find((c) => c.autoLayout);
    expect(container?.autoLayout).toMatchObject({ direction: 'horizontal', justify: 'space-between', align: 'center' });
    expect(clips.filter((c) => c.parent === container?.id)).toHaveLength(2);
  });

  it('carries the padding and the gap in doc pixels', () => {
    const layout = clips.find((c) => c.autoLayout)!.autoLayout!;
    const scale = card.doc.width / card.size.width;
    expect(layout.gap).toBeCloseTo(16 * scale, 1);
    expect(layout.padding.left).toBeCloseTo(20 * scale, 1);
  });

  it('lets the growing child fill the main axis and hugs the text', () => {
    const text = clips.find((c) => c.component === 'Text')!;
    expect(text.layoutItem).toMatchObject({ width: 'fill', height: 'hug' });
  });
});

describe('text in a frame much larger than the text', () => {
  const [item] = planOf(smallTextInHugeFrame(), newId)!.items;
  const text = clipsOf(item.doc).filter((c) => c.component === 'Text');

  it('keeps the text and its real font size', () => {
    const scale = item.doc.width / item.size.width;
    expect(text).toHaveLength(1);
    expect((text[0].props.size as number) * Math.min(item.doc.width, item.doc.height)).toBeCloseTo(12 * scale, 0);
  });
});

describe('component instances', () => {
  const innerTextId = (doc: { comps: Record<string, { component?: unknown; tracks: { clips: unknown[] }[] }> }) =>
    (Object.values(doc.comps).find((c) => c.component)!.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.component === 'Text')!).id;

  const instancesOf = (doc: Parameters<typeof clipsOf>[0]) => clipsOf(doc).filter((c) => c.component === 'Precomp' && c.name === 'Button');
  const mainsOf = (doc: { comps: Record<string, { component?: { name: string } }> }) => Object.values(doc.comps).filter((c) => c.component);
  const linkedOf = (doc: Parameters<typeof clipsOf>[0] & Parameters<typeof mainsOf>[0]) => instancesOf(doc).filter((c) => doc.comps[c.props.comp as string]?.component);

  it('stay instances of one main component when the main is in the paste', () => {
    const [item] = planOf(buttonInstances({ mainCopied: true }), newId)!.items;
    const instances = linkedOf(item.doc);
    expect(instances).toHaveLength(2);
    expect(mainsOf(item.doc).map((m) => m.component!.name)).toEqual(['Button']);
    expect(new Set(instances.map((c) => c.props.comp)).size).toBe(1);
  });

  it('put the second instance where it was in Figma', () => {
    const [item] = planOf(buttonInstances({ mainCopied: true }), newId)!.items;
    const [first, second] = linkedOf(item.doc);
    const scale = item.doc.width / item.size.width;
    expect(((second.transform.x ?? 0) - (first.transform.x ?? 0)) * item.doc.width).toBeCloseTo(300 * scale, 0);
  });

  it('draw both instances on the canvas', () => {
    const [item] = planOf(buttonInstances({ mainCopied: true }), newId)!.items;
    const list = drawFrame(prepare(item.doc, FEEGA_TOKENS, {}, { fonts: boxBook(), smoothing: Smoothing.Plain }), stillFrame(item.doc));
    const labels = list.items.filter((i) => 'clip' in i && String(i.clip).endsWith(innerTextId(item.doc)));
    expect(labels).toHaveLength(2);
    const [first, second] = linkedOf(item.doc).map((host) => list.items.find((i) => 'clip' in i && i.clip === `${host.id}__0__${innerTextId(item.doc)}`) as unknown as { matrix: number[] });
    const scale = item.doc.width / item.size.width;
    expect(second.matrix[4] - first.matrix[4]).toBeCloseTo(300 * scale, 0);
  });

  it('become groups named after the component when the main is not in the paste', () => {
    const [item] = planOf(buttonInstances({ mainCopied: false }), newId)!.items;
    expect(instancesOf(item.doc)).toHaveLength(2);
    expect(mainsOf(item.doc)).toHaveLength(0);
  });
});

describe('a whole landing page', () => {
  const [item] = planOf(landingPage().message, newId)!.items;
  const texts = clipsOf(item.doc).filter((c) => c.component === 'Text');
  const textOf = (c: MotionClip) => String(c.props.text);

  it('keeps every text, however small its size or long its paragraph', () => {
    const kept = texts.map(textOf);
    for (const expected of landingPage().texts) {
      expect(kept).toContain(expected);
    }
  });

  it('reports no text as skipped', () => {
    const { skipped } = planOf(landingPage().message, newId)!;
    expect(skipped.filter((s) => s.startsWith('style of'))).toEqual([]);
  });

  it('gives a text without a font size a readable one', () => {
    const copyright = texts.find((c) => textOf(c) === 'Copyright')!;
    expect(copyright.props.size as number).toBeGreaterThan(0);
  });

  it('shows the overridden label of an instance, not the main label', () => {
    const kept = texts.map(textOf);
    expect(kept).toContain(OVERRIDDEN_LABEL);
    expect(kept.filter((t) => t === 'Label')).toHaveLength(1);
  });

  it('paints the overridden label with the overriding fill', () => {
    const joined = texts.find((c) => textOf(c) === OVERRIDDEN_LABEL)!;
    expect(joined.props.color).toBe('#1ab34d');
  });

  it('leaves out the icon an instance hides', () => {
    const arrows = clipsOf(item.doc).filter((c) => c.name === HIDDEN_ICON);
    expect(arrows).toHaveLength(1);
  });

  it('does not report the flattened instance as a loss', () => {
    const { skipped } = planOf(landingPage().message, newId)!;
    expect(skipped.filter((s) => s.includes('flattened'))).toEqual([]);
  });
});

describe('a landing page through the clipboard encoding', () => {
  it('keeps the instance overrides after the Figma schema decodes them', () => {
    const plan = figmaPlan(figmaClipboardHtml(landingPage().message), newId)!;
    const kept = clipsOf(plan.items[0].doc).filter((c) => c.component === 'Text').map((c) => String(c.props.text));
    expect(kept).toContain(OVERRIDDEN_LABEL);
    expect(kept).toContain(landingPage().texts.at(-1));
  });
});

describe('a Figma frame with no fill', () => {
  it('lands as a see-through group, not on the black frame stage', () => {
    const page = { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page' };
    const frame = node('FRAME', 1, { w: 205, h: 158, fillPaints: [], frameMaskDisabled: false });
    const mark = node('ROUNDED_RECTANGLE', frame.id, { w: 50, h: 50, fillPaints: [solid(1, 1, 1)] });

    const [item] = planOf({ meta: {}, blobs: [], nodes: [page, frame, mark] }, newId)!.items;

    expect(item.destination).toBe(Destination.Free);
    expect(item.doc.background).toBe('transparent');
  });

  it('keeps several vectors together as one group, not loose elements', () => {
    const page = { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page' };
    const frame = node('FRAME', 1, { w: 300, h: 100, fillPaints: [], frameMaskDisabled: false });
    const letters = [0, 1, 2, 3, 4].map((i) => node('ROUNDED_RECTANGLE', frame.id, { x: i * 60, w: 50, h: 50, fillPaints: [solid(0, 0, 0)] }));

    const plan = planOf({ meta: {}, blobs: [], nodes: [page, frame, ...letters] }, newId)!;
    const [item] = plan.items;
    const roots = item.doc.tracks.flatMap((t) => t.clips);

    expect(plan.items).toHaveLength(1);
    expect(item.kind).toBe(FrameKind.Group);
    expect(roots).toHaveLength(1);
    expect(item.doc.background).toBe('transparent');
  });
});
