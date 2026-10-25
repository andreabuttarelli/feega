import { describe, expect, it } from 'vitest';
import { layersFrame } from './layers-frame';
import { OutputKind, type Output } from './move-element';
import { DocMode, docMode } from '@feega/motion-core/motion/still';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';

const BASE_ID = '11111111-2222-4333-8444-555555555555';
const TITLE_ID = '22222222-2222-4333-8444-555555555555';
const PARROT_ID = '33333333-2222-4333-8444-555555555555';

const ids = () => {
  let n = 0;
  return () => `n${++n}`;
};

const picture = (assetId: string, name: string, width = 1000, height = 1000): Output => ({ kind: OutputKind.Image, assetId, name, width, height });

const TITLE_BOX = { left: 0.1, top: 0.05, width: 0.8, height: 0.15 };
const PARROT_BOX = { left: 0.33, top: 0.274, width: 0.311, height: 0.717 };

describe('layersFrame', () => {
  const doc = layersFrame(picture(BASE_ID, 'base', 1600, 900), [{ output: picture(TITLE_ID, 'title'), box: TITLE_BOX }, { output: picture(PARROT_ID, 'parrot'), box: PARROT_BOX }], ids());
  const clips = doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Image');
  const clipOf = (assetId: string) => clips.find((c) => c.props.assetId === assetId)!;

  it('is a still frame the size of the base picture holding the base and every layer as an image element', () => {
    expect(docMode(doc)).toBe(DocMode.Still);
    expect({ width: doc.width, height: doc.height }).toEqual({ width: 1600, height: 900 });
    expect(clips).toHaveLength(3);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('puts each layer where its box was on the picture, centre and size as fractions of the frame', () => {
    expect(clipOf(TITLE_ID).props).toMatchObject({ x: 0.5, y: 0.125, width: 0.8, height: 0.15 });
    const parrot = clipOf(PARROT_ID).props;
    expect(parrot.x).toBeCloseTo(0.4855, 6);
    expect(parrot.y).toBeCloseTo(0.6325, 6);
    expect(parrot).toMatchObject({ width: 0.311, height: 0.717 });
  });

  it('stacks the layers above the base, in the order they were given', () => {
    const order = doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Image').map((c) => c.props.assetId);

    expect(order.indexOf(TITLE_ID)).toBeLessThan(order.indexOf(BASE_ID));
    expect(order.indexOf(PARROT_ID)).toBeLessThan(order.indexOf(BASE_ID));
  });

  it('carries every asset the clips use', () => {
    expect(doc.assets.map((a) => a.id).sort()).toEqual([BASE_ID, PARROT_ID, TITLE_ID].sort());
  });
});
