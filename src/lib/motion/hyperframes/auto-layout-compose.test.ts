import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { setAutoLayout } from '../layout/ops';
import { setParent } from '../parent-ops';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const row = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Kicker', from: 0, props: { x: 0.9, y: 0.9, width: 0.1, height: 0.05 } }, 'k1'));
  doc = must(addClip(doc, { component: 'Kicker', from: 0, props: { x: 0.9, y: 0.9, width: 0.1, height: 0.05 } }, 'k2'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', fill: 'transparent', x: 0.5, y: 0.5, width: 1, height: 0.05 } }, 'box'));
  doc = must(setParent(doc, 'k1', 'box'));
  doc = must(setParent(doc, 'k2', 'box'));
  return must(setAutoLayout(doc, 'box', {}));
})();

const styleOf = (html: string, clipId: string) => html.slice(html.indexOf(`data-clip="${clipId}"`)).match(/class="box" style="([^"]*)"/)![1];

describe('auto layout in the composition', () => {
  it('draws each child in the slot the layout gives it, not where it was stored', () => {
    const html = composeHtml({ doc: row, tokens: FEEGA_TOKENS, assets: {} });
    expect(styleOf(html, 'k1')).toContain('left:0px');
    expect(styleOf(html, 'k2')).toContain('left:108px');
    expect(styleOf(html, 'k2')).toContain('top:513px');
  });
});
