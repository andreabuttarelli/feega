import { Ease } from '@feega/motion-core/motion/design';
import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';
import { textToPath } from './text-outline';
import { lettering } from './fixtures/lettering';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const start = newMotionDoc(MotionFormat.Square);
const BOX_FRACTION = 0.5;

const withText = (props: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  must(addClip(start, { component: 'Text', from: 0, durationInFrames: 60, props: { x: 0.5, y: 0.5, width: BOX_FRACTION, height: BOX_FRACTION, size: 0.1, align: 'left', ...props }, ...extra }, 't'));

const outlined = (props: Record<string, unknown>) => must(textToPath(withText(props), 't', lettering));

describe('text to path', () => {
  it('turns a text clip into a free path shape in the same box', () => {
    const clip = findClip(outlined({ text: 'A' }), 't')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.props).toMatchObject({ shape: 'path', x: 0.5, y: 0.5, width: BOX_FRACTION, height: BOX_FRACTION });
  });

  it('keeps fills, opacity, transform and constraints', () => {
    const doc = withText({ text: 'A', color: '#ff0000', opacity: 0.4 }, { transform: { rotateZ: 12 }, constraints: { horizontal: 'right', vertical: 'top' } });
    const before = findClip(doc, 't')!.clip;
    const after = findClip(must(textToPath(doc, 't', lettering)), 't')!.clip;

    expect(after.transform).toEqual(before.transform);
    expect(after.constraints).toEqual(before.constraints);
    expect(after.props.opacity).toBe(0.4);
    expect(JSON.stringify(after.props.fills)).toContain('#ff0000');
  });

  it('outlines justified text, an alignment a shape does not have', () => {
    expect(findClip(outlined({ text: 'a line long enough to be justified', align: 'justify' }), 't')!.clip.component).toBe('Shape');
  });

  it('drops keyframes of props a shape does not have, and keeps the rest', () => {
    const key = (value: number) => [{ frame: 0, value, ease: Ease.Standard }];
    const doc = must(setKeyframes(must(setKeyframes(withText({ text: 'A' }), 't', 'tracking', key(0.1))), 't', 'x', key(0.5)));
    const after = findClip(must(textToPath(doc, 't', lettering)), 't')!.clip;

    expect(Object.keys(after.keyframes)).toEqual(['x']);
  });

  it('refuses what is not text, has no letters, has no font, or does not fit a path', () => {
    const shape = must(addClip(start, { component: 'Shape', from: 0, durationInFrames: 60, props: {} }, 't'));

    expect(textToPath(shape, 't', lettering).ok).toBe(false);
    expect(textToPath(withText({ text: '   ' }), 't', lettering).ok).toBe(false);
    expect(textToPath(withText({ text: 'A' }), 't', { ...lettering, fonts: () => null }).ok).toBe(false);
    expect(textToPath(withText({ text: 'ABCDEFGHIJ'.repeat(300), width: 1, height: 1, size: 0.01 }), 't', lettering).ok).toBe(false);
    expect(textToPath(start, 'missing', lettering).ok).toBe(false);
  });
});
