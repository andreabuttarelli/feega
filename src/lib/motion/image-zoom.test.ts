import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { Ease } from './design';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { animProp } from './keyframes';
import { addClip, setKeyframes, type OpResult } from './timeline';
import { composeHtml } from './hyperframes/compose';
import { Quality, docProblems } from './direction';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shot = (props: Record<string, unknown> = {}) =>
  must(addClip({ ...newMotionDoc(MotionFormat.Landscape), assets: [{ id: 'cap', kind: 'image', name: 'cap' }] }, { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: 'cap', fit: 'cover', width: 0.66, height: 0.7, ...props } }, 'i'));

const keyed = (doc: MotionDoc, key: string, from: number, to: number) => must(setKeyframes(doc, 'i', key, [{ frame: 0, value: from, ease: Ease.Linear }, { frame: 90, value: to, ease: Ease.Linear }]));

describe('zooming inside a picture box', () => {
  it('zoom and the pan point are keyframable on an Image', () => {
    expect(animProp('Image', 'zoom')).not.toBeNull();
    expect(animProp('Image', 'focusX')).not.toBeNull();
    expect(animProp('Image', 'focusY')).not.toBeNull();
  });

  it('the picture is scaled inside its clipped box around the focus point, the box stays put', () => {
    const html = composeHtml({ doc: shot({ zoom: 2.5, focusX: 0.3, focusY: 0.1 }), tokens: FEEGA_TOKENS, assets: { cap: 'https://x/cap.png' } });

    expect(html).toMatch(/scale\(var\(--kc-zoom, ?2\.5\)\)/);
    expect(html).toContain('overflow:hidden');
  });

  it('a capture zoomed past its pixels is named soft, a modest zoom is not', () => {
    const pixels = { cap: { width: 2880, height: 1800 } };
    const soft = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0, pixels }).filter((p) => p.kind === Quality.SoftPicture);

    expect(soft(keyed(shot(), 'zoom', 1, 4))).toHaveLength(1);
    expect(soft(keyed(shot(), 'zoom', 1.4, 1.6))).toEqual([]);
  });
});
