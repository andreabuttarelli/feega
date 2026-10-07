import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { FadeEdge, dragFade, fadeHandles } from './fade-handles';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(
  addClip(
    newMotionDoc(MotionFormat.Vertical),
    {
      component: 'Audio',
      from: 30,
      durationInFrames: 120,
      props: { assetId: 'm', fadeIn: 1, fadeOut: 0.5 }
    },
    'a'
  )
);
const clip = findClip(doc, 'a')!.clip;
const props = (d: MotionDoc) => findClip(d, 'a')!.clip.props as { fadeIn: number; fadeOut: number };

describe('fade handles', () => {
  it('sit inside the clip, as far in as each fade lasts', () => {
    expect(fadeHandles(clip, 30, 2)).toEqual([
      { edge: FadeEdge.In, x: 120 },
      { edge: FadeEdge.Out, x: 270 }
    ]);
  });

  it('only sounding clips have them', () => {
    const shape = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Shape', from: 0 }, 's'));
    expect(fadeHandles(findClip(shape, 's')!.clip, 30, 2)).toEqual([]);
  });

  it('dragging the in handle sets the fade in from the clip start, to a tenth of a second', () => {
    expect(props(must(dragFade(doc, 'a', FadeEdge.In, 30 + 47))).fadeIn).toBe(1.6);
  });

  it('dragging the out handle measures from the clip end', () => {
    expect(props(must(dragFade(doc, 'a', FadeEdge.Out, 150 - 60))).fadeOut).toBe(2);
  });

  it('a fade never passes the middle of the clip nor goes below zero', () => {
    expect(props(must(dragFade(doc, 'a', FadeEdge.In, 500))).fadeIn).toBe(2);
    expect(props(must(dragFade(doc, 'a', FadeEdge.Out, 500))).fadeOut).toBe(0);
  });
});
