import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxFace } from '$lib/motion/gpu-full/text/test-face';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { addClip } from '@feega/motion-core/motion/timeline';
import type { ComponentId } from '@feega/motion-core/motion/components';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import { framePicker } from './frame-pick';
import { FramePlacements } from './frame-placements';

const EM_WIDE = 1000;
const wideFace = { ...boxFace, shape: (text: string) => [...text].map((c) => ({ glyph: c.codePointAt(0)!, advance: EM_WIDE, dx: 0, dy: 0, chars: 1 })) };
const fonts: FaceBook = () => ({ face: wideFace, skew: 0 });
const loaded = async () => ({ fonts, smoothing: Smoothing.Plain });

const WORDS = { a: 'Ciao', b: 'mondo', c: 'bello' };

function added(doc: MotionDoc, component: ComponentId, props: Record<string, unknown>, id: string): MotionDoc {
  const result = addClip(doc, { component, from: 0, durationInFrames: 150, props }, id);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function row(): MotionDoc {
  const stacked = added(newMotionDoc(MotionFormat.Landscape), 'Shape', { shape: 'rect', x: 0.5, y: 0.5, width: 0.9, height: 0.3 }, 'row');
  const doc = Object.entries(WORDS).reduce((d, [id, text]) => added(d, 'Text', { text, size: 0.05, sizing: 'auto', align: 'left' }, id), stacked);
  const laid = (c: MotionClip): MotionClip => (c.id === 'row' ? { ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Horizontal, gap: 10, order: Object.keys(WORDS) } } : c.id in WORDS ? { ...c, parent: 'row', layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug, height: Sizing.Hug } } : c);
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => laid(c as MotionClip)) })) } as MotionDoc;
}

const settled = () => new Promise((r) => setTimeout(r, 0));

describe('frame picker geometry', () => {
  it('outlines each text in a stack where the GPU draws it', async () => {
    const live = { doc: row(), tokens: FEEGA_TOKENS, assets: {} };
    const picker = framePicker(live, () => 0, loaded);
    picker.frameRect('a');
    await settled();

    const drawn = new FramePlacements(prepare(live.doc, live.tokens, live.assets, { fonts, smoothing: Smoothing.Plain }), 0);
    for (const id of ['a', 'b', 'c']) {
      expect(picker.frameRect(id)).toEqual(drawn.rectOf(id));
    }
  });
});
