import { describe, expect, it } from 'vitest';
import { figmaClipboardHtml } from '../../../../tests/fixtures/figma/clipboard';
import { gradient, node, solid } from '../../../../tests/fixtures/figma/elements';
import { restMessage, type RestNode } from '$lib/server/figma/rest-message';
import { mattePairs } from '@feega/motion-core/motion/matte';
import { parseMotionDoc, type MotionClip } from '@feega/motion-core/motion/doc';
import type { FigmaMessage, FigmaRawNode } from './archive';
import { figmaPlan, planOf, type FigmaPlan, type PlanItem } from './figma-doc';

const PAGE = 1;
const FILE_KEY = 'AbCdEf1234567890';
const IMAGE_REF = 'cd'.repeat(20);
const IMAGE_HASH = Uint8Array.from({ length: 20 }, () => 0xcd);

let n = 0;
const newId = () => `id${++n}`;

type Built = { item: PlanItem; plan: FigmaPlan };

type Case = {
  name: string;
  frame?: Partial<FigmaRawNode>;
  restFrame?: Partial<RestNode>;
  kids: (parent: number) => FigmaRawNode[];
  restKids: RestNode[];
  check: (built: Built, clip: (name: string) => MotionClip) => void;
};

const clipsOf = (doc: PlanItem['doc']): MotionClip[] => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

const FRAME_SIZE = { w: 400, h: 300 };
const REST_FILL = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }];

function clipboardBuilt(c: Case): Built {
  const page: FigmaRawNode = { guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' };
  const frame = node('FRAME', PAGE, { ...FRAME_SIZE, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, name: 'Frame', ...c.frame });
  const message: FigmaMessage = { meta: { fileKey: FILE_KEY }, blobs: [], nodes: [page, frame, ...c.kids(frame.id)] };
  const plan = figmaPlan(figmaClipboardHtml(message), newId)!;
  return { plan, item: plan.items[0] };
}

function restBuilt(c: Case): Built {
  const frame: RestNode = {
    id: '1:1',
    name: 'Frame',
    type: 'FRAME',
    size: { x: FRAME_SIZE.w, y: FRAME_SIZE.h },
    relativeTransform: [[1, 0, 0], [0, 1, 0]],
    clipsContent: true,
    fills: REST_FILL,
    children: c.restKids,
    ...c.restFrame
  };
  const plan = planOf(restMessage([frame], FILE_KEY), newId)!;
  return { plan, item: plan.items[0] };
}

const restRect = (name: string, extra: Partial<RestNode> = {}): RestNode => ({ id: `r:${name}`, name, type: 'RECTANGLE', size: { x: 100, y: 50 }, relativeTransform: [[1, 0, 10], [0, 1, 20]], fills: REST_FILL, ...extra });
const rect = (parent: number, name: string, extra: Partial<FigmaRawNode> & { slot?: string } = {}) => node('ROUNDED_RECTANGLE', parent, { x: 10, y: 20, w: 100, h: 50, fillPaints: [solid(1, 0, 0)], name, ...extra });

const textBody = (parent: number, extra: Partial<FigmaRawNode> & { slot?: string }) =>
  node('TEXT', parent, { x: 0, y: 0, w: 200, h: 60, name: 'words', fontName: { family: 'Inter', style: 'Regular', postscript: '' }, fontSize: 16, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Hello world' }, ...extra });

const restText = (extra: Partial<RestNode>): RestNode => ({
  id: 'r:words',
  name: 'words',
  type: 'TEXT',
  size: { x: 200, y: 60 },
  relativeTransform: [[1, 0, 0], [0, 1, 0]],
  characters: 'Hello world',
  fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
  ...extra,
  style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, ...(extra.style ?? {}) }
});

const stack = { stackMode: 'VERTICAL', stackPrimarySizing: 'FIXED', stackCounterSizing: 'FIXED' };
const restStack = { layoutMode: 'VERTICAL', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED' };

const CASES: Case[] = [
  {
    name: 'constraints on a child of a frame without auto layout',
    kids: (p) => [rect(p, 'pinned', { horizontalConstraint: 'MAX', verticalConstraint: 'STRETCH' }), rect(p, 'centred', { horizontalConstraint: 'CENTER', verticalConstraint: 'SCALE', slot: 'b' })],
    restKids: [restRect('pinned', { constraints: { horizontal: 'RIGHT', vertical: 'TOP_BOTTOM' } }), restRect('centred', { constraints: { horizontal: 'CENTER', vertical: 'SCALE' } })],
    check: (_, clip) => {
      expect(clip('pinned').constraints).toEqual({ horizontal: 'right', vertical: 'top_bottom' });
      expect(clip('centred').constraints).toEqual({ horizontal: 'center', vertical: 'scale' });
    }
  },
  {
    name: 'constraints are ignored for a child of an auto layout frame',
    frame: stack,
    restFrame: restStack,
    kids: (p) => [rect(p, 'stacked', { horizontalConstraint: 'MAX', verticalConstraint: 'MAX' })],
    restKids: [restRect('stacked', { constraints: { horizontal: 'RIGHT', vertical: 'BOTTOM' } })],
    check: (_, clip) => expect(clip('stacked').constraints).toEqual({ horizontal: 'left', vertical: 'top' })
  },
  {
    name: 'min and max sizes of a child in auto layout',
    frame: stack,
    restFrame: restStack,
    kids: (p) => [rect(p, 'bounded', { minSize: { value: { x: 50, y: 20 } }, maxSize: { value: { x: 300, y: 80 } } })],
    restKids: [restRect('bounded', { minWidth: 50, minHeight: 20, maxWidth: 300, maxHeight: 80 })],
    check: (_, clip) => expect(clip('bounded').layoutItem).toMatchObject({ minWidth: 50, minHeight: 20, maxWidth: 300, maxHeight: 80 })
  },
  {
    name: 'a child auto layout frame that hugs keeps hugging inside its parent',
    frame: stack,
    restFrame: restStack,
    kids: (p) => {
      const card = node('FRAME', p, { w: 100, h: 50, name: 'card', fillPaints: [solid(0, 1, 0)], frameMaskDisabled: false, stackMode: 'HORIZONTAL', stackPrimarySizing: 'RESIZE_TO_FIT', stackCounterSizing: 'RESIZE_TO_FIT' });
      return [card, rect(card.id, 'inner', { slot: 'a' })];
    },
    restKids: [{ id: 'r:card', name: 'card', type: 'FRAME', size: { x: 100, y: 50 }, relativeTransform: [[1, 0, 0], [0, 1, 0]], layoutMode: 'HORIZONTAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', fills: REST_FILL, children: [restRect('inner')] }],
    check: (_, clip) => expect(clip('card').layoutItem).toMatchObject({ width: 'hug', height: 'hug' })
  },
  {
    name: 'a mask layer cuts the siblings above it',
    kids: (p) => [rect(p, 'under', { slot: 'a' }), rect(p, 'cutter', { mask: true, maskType: 'ALPHA', slot: 'b' }), rect(p, 'cut one', { slot: 'c' }), rect(p, 'cut two', { slot: 'd' })],
    restKids: [restRect('under'), restRect('cutter', { isMask: true, maskType: 'ALPHA' }), restRect('cut one'), restRect('cut two')],
    check: ({ item }, clip) => {
      const cutter = clip('cutter');
      expect(clip('under').matte).toBe('none');
      expect(clip('cut one')).toMatchObject({ matte: 'alpha', matteFrom: cutter.id });
      expect(clip('cut two')).toMatchObject({ matte: 'alpha', matteFrom: cutter.id });
      expect(mattePairs(item.doc).map((m) => m.source)).toEqual([cutter.id, cutter.id]);
    }
  },
  {
    name: 'a luminance mask cuts by luminance',
    kids: (p) => [rect(p, 'cutter', { mask: true, maskType: 'LUMINANCE', slot: 'a' }), rect(p, 'cut', { slot: 'b' })],
    restKids: [restRect('cutter', { isMask: true, maskType: 'LUMINANCE' }), restRect('cut')],
    check: (_, clip) => expect(clip('cut')).toMatchObject({ matte: 'luma', matteFrom: clip('cutter').id })
  },
  {
    name: 'a second mask takes over from the first',
    kids: (p) => [rect(p, 'first', { mask: true, maskType: 'ALPHA', slot: 'a' }), rect(p, 'by first', { slot: 'b' }), rect(p, 'second', { mask: true, maskType: 'ALPHA', slot: 'c' }), rect(p, 'by second', { slot: 'd' })],
    restKids: [restRect('first', { isMask: true, maskType: 'ALPHA' }), restRect('by first'), restRect('second', { isMask: true, maskType: 'ALPHA' }), restRect('by second')],
    check: (_, clip) => {
      expect(clip('by first').matteFrom).toBe(clip('first').id);
      expect(clip('by second').matteFrom).toBe(clip('second').id);
    }
  },
  {
    name: 'a hidden mask cuts nothing',
    kids: (p) => [rect(p, 'cutter', { mask: true, maskType: 'ALPHA', visible: false, slot: 'a' }), rect(p, 'free', { slot: 'b' })],
    restKids: [restRect('cutter', { isMask: true, maskType: 'ALPHA', visible: false }), restRect('free')],
    check: (_, clip) => expect(clip('free').matte).toBe('none')
  },
  {
    name: 'an outline mask without a fill is reported, not silently emptied',
    kids: (p) => [rect(p, 'cutter', { mask: true, maskType: 'OUTLINE', fillPaints: [], slot: 'a' }), rect(p, 'cut', { slot: 'b' })],
    restKids: [restRect('cutter', { isMask: true, maskType: 'VECTOR', fills: [] }), restRect('cut')],
    check: ({ plan }) => expect(plan.skipped.some((s) => s.includes('outline mask'))).toBe(true)
  },
  {
    name: 'paragraph spacing, indent and vertical alignment of a text',
    kids: (p) => [textBody(p, { textAlignVertical: 'BOTTOM', paragraphSpacing: 12, paragraphIndent: 24 })],
    restKids: [restText({ style: { textAlignVertical: 'BOTTOM', paragraphSpacing: 12, paragraphIndent: 24 } })],
    check: (_, clip) => expect(clip('words').props).toMatchObject({ verticalAlign: 'bottom', paragraphSpacing: 0.75, paragraphIndent: 1.5 })
  },
  {
    name: 'a text without a vertical alignment stays at the top',
    kids: (p) => [textBody(p, {})],
    restKids: [restText({})],
    check: (_, clip) => expect(clip('words').props.verticalAlign).toBe('top')
  },
  {
    name: 'a gradient on a run of a text',
    kids: (p) => [textBody(p, { textData: { characters: 'Hello world', characterStyleIDs: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], styleOverrideTable: [{ guid: { sessionID: 0, localID: 0 }, styleID: 1, fillPaints: [gradient('GRADIENT_LINEAR')] }] } })],
    restKids: [
      restText({
        characterStyleOverrides: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        styleOverrideTable: {
          1: {
            fills: [
              {
                type: 'GRADIENT_LINEAR',
                gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }],
                gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }]
              }
            ]
          }
        }
      })
    ],
    check: (_, clip) => {
      const [run] = clip('words').props.runs as { start: number; end: number; fill?: { type: string; stops: unknown[] } }[];
      expect(run).toMatchObject({ start: 5, end: 11 });
      expect(run.fill).toMatchObject({ type: 'linear-gradient' });
      expect(run.fill!.stops).toHaveLength(2);
    }
  },
  {
    name: 'stroke caps, joins and a full dash pattern',
    kids: (p) => [rect(p, 'inked', { strokePaints: [solid(0, 0, 0)], strokeWeight: 2, strokeCap: 'ROUND', strokeJoin: 'BEVEL', dashPattern: [4, 2, 1, 2] })],
    restKids: [restRect('inked', { strokes: REST_FILL, strokeWeight: 2, strokeCap: 'ROUND', strokeJoin: 'BEVEL', strokeDashes: [4, 2, 1, 2] })],
    check: (_, clip) => {
      const [stroke] = clip('inked').props.strokes as { cap: string; join: string; pattern: number[] }[];
      expect(stroke).toMatchObject({ cap: 'round', join: 'bevel' });
      expect(stroke.pattern).toHaveLength(4);
    }
  },
  {
    name: 'a plain stroke keeps the default cap and join',
    kids: (p) => [rect(p, 'inked', { strokePaints: [solid(0, 0, 0)], strokeWeight: 2, dashPattern: [4, 2] })],
    restKids: [restRect('inked', { strokes: REST_FILL, strokeWeight: 2, strokeDashes: [4, 2] })],
    check: (_, clip) => {
      const [stroke] = clip('inked').props.strokes as { cap?: string; join?: string; pattern?: number[]; dash: number }[];
      expect(stroke.cap ?? 'butt').toBe('butt');
      expect(stroke.join ?? 'miter').toBe('miter');
      expect(stroke.pattern).toBeUndefined();
      expect(stroke.dash).toBeGreaterThan(0);
    }
  },
  {
    name: 'per-side stroke weights are reported, not silently averaged',
    kids: (p) => [rect(p, 'inked', { strokePaints: [solid(0, 0, 0)], strokeWeight: 2, borderStrokeWeightsIndependent: true, borderTopWeight: 4, borderBottomWeight: 0, borderLeftWeight: 1, borderRightWeight: 1 })],
    restKids: [restRect('inked', { strokes: REST_FILL, strokeWeight: 2, individualStrokeWeights: { top: 4, right: 1, bottom: 0, left: 1 } })],
    check: ({ plan }) => expect(plan.skipped.some((s) => s.includes('per-side stroke'))).toBe(true)
  },
  {
    name: 'an inner shadow spread is reported, not silently dropped',
    kids: (p) => [rect(p, 'lit', { effects: [{ type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 2 }, radius: 4, spread: 3, visible: true }] })],
    restKids: [restRect('lit', { effects: [{ type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 2 }, radius: 4, spread: 3, visible: true }] })],
    check: ({ plan }) => expect(plan.skipped.some((s) => s.includes('inner shadow spread'))).toBe(true)
  },
  {
    name: 'a layer blur of 20 is a gaussian of sigma 10',
    kids: (p) => [rect(p, 'soft', { effects: [{ type: 'FOREGROUND_BLUR', radius: 20, visible: true }] })],
    restKids: [restRect('soft', { effects: [{ type: 'FOREGROUND_BLUR', radius: 20, visible: true }] })],
    check: (_, clip) => expect(clip('soft').effects?.[0]).toMatchObject({ kind: 'gaussian-blur', params: { radius: 10 } })
  },
  {
    name: 'a hidden layer stays in the tree, hidden',
    kids: (p) => [rect(p, 'seen', { slot: 'a' }), rect(p, 'ghost', { visible: false, slot: 'b' })],
    restKids: [restRect('seen'), restRect('ghost', { visible: false })],
    check: (_, clip) => {
      expect(clip('ghost').hidden).toBe(true);
      expect(clip('seen').hidden).toBeFalsy();
    }
  },
  {
    name: 'a hidden layer does not take room in an auto layout',
    frame: stack,
    restFrame: restStack,
    kids: (p) => [rect(p, 'seen', { slot: 'a' }), rect(p, 'ghost', { visible: false, slot: 'b' })],
    restKids: [restRect('seen'), restRect('ghost', { visible: false })],
    check: (_, clip) => expect(clip('ghost').hidden).toBe(true)
  }
];

const IMAGE_CASES: Case[] = [
  {
    name: 'a stretched image with a crop transform lands as a crop window',
    kids: (p) => [rect(p, 'photo', { fillPaints: [{ type: 'IMAGE', opacity: 1, visible: true, image: { hash: IMAGE_HASH }, imageScaleMode: 'STRETCH', transform: { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 } }] })],
    restKids: [restRect('photo', { fills: [{ type: 'IMAGE', imageRef: IMAGE_REF, scaleMode: 'STRETCH', imageTransform: [[0.5, 0, 0.25], [0, 0.5, 0.25]] }] })],
    check: ({ item }) => expect(item.images[0]).toMatchObject({ fit: 'crop', crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })
  },
  {
    name: 'a tiled image keeps its scale and rotation',
    kids: (p) => [rect(p, 'photo', { fillPaints: [{ type: 'IMAGE', opacity: 1, visible: true, image: { hash: IMAGE_HASH }, imageScaleMode: 'TILE', scale: 2, rotation: 90 }] })],
    restKids: [restRect('photo', { fills: [{ type: 'IMAGE', imageRef: IMAGE_REF, scaleMode: 'TILE', scalingFactor: 2, rotation: 90 }] })],
    check: ({ item }) => expect(item.images[0]).toMatchObject({ fit: 'tile', scale: 2, rotation: 90 })
  },
  {
    name: 'a plain fill image stays a cover with no crop',
    kids: (p) => [rect(p, 'photo', { fillPaints: [{ type: 'IMAGE', opacity: 1, visible: true, image: { hash: IMAGE_HASH }, imageScaleMode: 'FILL' }] })],
    restKids: [restRect('photo', { fills: [{ type: 'IMAGE', imageRef: IMAGE_REF, scaleMode: 'FILL' }] })],
    check: ({ item }) => {
      expect(item.images[0]).toMatchObject({ fit: 'cover' });
      expect(item.images[0].crop).toBeUndefined();
    }
  }
];

const nameOf = (built: Built) => (name: string): MotionClip => {
  const found = clipsOf(built.item.doc).find((c) => c.name === name);
  if (!found) {
    throw new Error(`no clip ${name} in ${clipsOf(built.item.doc).map((c) => c.name).join(', ')}`);
  }
  return found;
};

describe.each([...CASES, ...IMAGE_CASES])('$name', (c) => {
  it('through the clipboard', () => {
    const built = clipboardBuilt(c);
    expect(parseMotionDoc(built.item.doc).ok).toBe(true);
    c.check(built, nameOf(built));
  });

  it('through the REST link', () => {
    const built = restBuilt(c);
    expect(parseMotionDoc(built.item.doc).ok).toBe(true);
    c.check(built, nameOf(built));
  });
});
