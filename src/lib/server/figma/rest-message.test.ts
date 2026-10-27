import { describe, expect, it } from 'vitest';
import { planOf } from '$lib/canvas/figma/figma-doc';
import { Destination } from '$lib/canvas/figma/scene';
import { FrameKind } from '$lib/canvas/motion-node';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { restMessage, type RestNode } from './rest-message';

const IMAGE_REF = 'ab'.repeat(20);
const FILE_KEY = 'AbCdEf1234567890';

const rect = (id: string, extra: Partial<RestNode> = {}): RestNode => ({
  id,
  name: `rect ${id}`,
  type: 'RECTANGLE',
  size: { x: 100, y: 50 },
  relativeTransform: [[1, 0, 10], [0, 1, 20]],
  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
  ...extra
});

const card: RestNode = {
  id: '1:2',
  name: 'Card',
  type: 'FRAME',
  size: { x: 300, y: 200 },
  relativeTransform: [[1, 0, 40], [0, 1, 60]],
  clipsContent: true,
  layoutMode: 'VERTICAL',
  itemSpacing: 8,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 12,
  paddingBottom: 12,
  primaryAxisSizingMode: 'AUTO',
  counterAxisSizingMode: 'FIXED',
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'MAX',
  cornerRadius: 8,
  fills: [
    {
      type: 'GRADIENT_LINEAR',
      gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }],
      gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }]
    }
  ],
  effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0, visible: true }],
  children: [
    rect('1:3', { fills: [{ type: 'IMAGE', imageRef: IMAGE_REF }], layoutGrow: 1, layoutAlign: 'STRETCH' }),
    {
      id: '1:4',
      name: 'Title',
      type: 'TEXT',
      size: { x: 120, y: 24 },
      relativeTransform: [[1, 0, 0], [0, 1, 80]],
      characters: 'Hello world',
      style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 20, textAlignHorizontal: 'CENTER', letterSpacing: 1, lineHeightUnit: 'PIXELS', lineHeightPx: 28 },
      characterStyleOverrides: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
      styleOverrideTable: { 1: { fontWeight: 400, italic: true, fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } }] } },
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }]
    },
    {
      id: '1:5',
      name: 'Arrow',
      type: 'VECTOR',
      size: { x: 20, y: 20 },
      relativeTransform: [[1, 0, 200], [0, 1, 100]],
      fillGeometry: [{ path: 'M 0 0 L 20 0 L 20 20 Q 10 30 0 20 Z', windingRule: 'NONZERO' }],
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }]
    }
  ]
};

let n = 0;
const newId = () => `id${++n}`;
const planOfFrames = (frames: RestNode[]) => planOf(restMessage(frames, FILE_KEY), newId)!;

describe('Figma REST nodes carried into the canvas mapper', () => {
  const plan = planOfFrames([card]);
  const [item] = plan.items;

  it('lands a frame as a frame doc the size of the Figma frame', () => {
    expect(plan.items).toHaveLength(1);
    expect(item.destination).toBe(Destination.Frame);
    expect(item.kind).toBe(FrameKind.Frame);
    expect(item.size).toEqual({ width: 300, height: 200 });
    expect(item.name).toBe('Card');
    expect(parseMotionDoc(item.doc).ok).toBe(true);
  });

  it('keeps the file key for the image fill', () => {
    expect(plan.fileKey).toBe(FILE_KEY);
  });

  it('asks for the image by the hash Figma names', () => {
    expect(item.images.map((i) => i.hash)).toEqual([IMAGE_REF]);
  });

  it('carries text, vectors and the shadow without reporting them lost', () => {
    expect(JSON.stringify(item.doc)).toContain('Hello world');
    expect(plan.skipped.filter((s) => !s.startsWith('image'))).toEqual([]);
  });

  it('places several frames side by side by their Figma positions', () => {
    const two = planOfFrames([card, { ...card, id: '9:9', name: 'Other', relativeTransform: [[1, 0, 640], [0, 1, 60]] }]);
    const [a, b] = two.items;
    expect(b.centre.x - a.centre.x).toBe(600);
    expect(b.centre.y - a.centre.y).toBe(0);
  });

  it('skips a hidden layer', () => {
    const hidden = planOfFrames([{ ...card, children: [rect('2:1', { visible: false }), rect('2:2')] }]);
    expect(JSON.stringify(hidden.items[0].doc)).not.toContain('rect 2:1');
  });
});
