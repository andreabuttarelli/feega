import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc } from './doc';
import type { Outliner } from './fonts/outliner';
import { outlineTexts } from './text-outline-run';
import { addClip, type OpResult } from './timeline';

const square: Outliner = {
  advance: () => 0.5,
  ascent: 0.8,
  descent: 0.2,
  trace: (_, x, y, size) => [{ type: 'M', x, y }, { type: 'L', x: x + size, y }, { type: 'L', x, y: y - size }, { type: 'Z' }]
};

const must = (r: OpResult) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 'a'));

describe('outline texts', () => {
  it('asks for the font of each clip and outlines it', async () => {
    const asked: string[] = [];
    const result = await outlineTexts(doc, ['a'], async (url) => (asked.push(url), square));

    expect(result.ok && findClip(result.doc, 'a')!.clip.component).toBe('Shape');
    expect(asked[0]).toContain('dm-sans');
  });

  it('says so when the font cannot be loaded', async () => {
    const result = await outlineTexts(doc, ['a'], async () => null);

    expect(result.ok).toBe(false);
  });
});
