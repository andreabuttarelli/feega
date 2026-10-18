import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = [
  (d: MotionDoc) => addClip(d, { component: 'Shape3D', from: 0, durationInFrames: 30 }, 'cube'),
  (d: MotionDoc) => addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'hi' } }, 'title')
].reduce((d, add) => must(add(d)), newMotionDoc(MotionFormat.Landscape));

const compose = (only?: ReadonlySet<string>) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test', only });

describe('a composition limited to some clips', () => {
  it('draws only those clips', () => {
    const html = compose(new Set(['title']));

    expect(html).toContain('data-clip="title"');
    expect(html).not.toContain('data-clip="cube"');
  });

  it('boots no script for the clips it leaves out', () => {
    expect(compose()).toMatch(/feega-webgl" content="[1-9]/);
    expect(compose(new Set(['title']))).toContain('feega-webgl" content="0"');
  });
});
