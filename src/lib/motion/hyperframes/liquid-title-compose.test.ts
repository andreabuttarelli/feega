import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { parseMotionDoc, type MotionDoc } from '../doc';
import { setExpression } from '../expression/ops';
import { Liveness } from '../interactive/settings';
import { ROW } from '../blob/shape';
import { CAPTURE_REQUEST } from './capture';
import { composeHtml } from './compose';
import fixture from '../fixtures/liquid-glass-title.json';

const DROP = '918f44bd';
const TITLE = 'd3fc0b73';
const ANIMATOR = '3bbfaa48';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(parseMotionDoc(fixture));
const baked = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Baked });

function centers(html: string): number[] {
  const raw = /const B=(\[.*?\]);\n/.exec(html)?.[1];
  const [bake] = JSON.parse(raw ?? '[]') as { rows: number[][] }[];
  return bake.rows.map((row) => row[ROW.center]);
}

describe('a title under a liquid drop, as the video render receives it', () => {
  it('keeps the title reveal on the timeline', () => {
    expect(baked(doc)).toContain(`tl.fromTo("#ta-${TITLE}",{"--ta-${ANIMATOR}-offset":-40`);
  });

  it('bakes the drop travelling across the title and draws it with WebGL', () => {
    const html = baked(doc);
    const xs = centers(html);

    expect(html).toContain("getContext('webgl'");
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(doc.width * 0.3);
  });

  it('still moves a drop that follows the cursor, as no cursor exists in a video', () => {
    const following = must(setExpression(must(setExpression(doc, DROP, 'centerX', 'input.smooth(input.pointer.x, 0.2)')), DROP, 'centerY', 'input.smooth(input.pointer.y, 0.2)'));
    const xs = centers(baked(following));

    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(doc.width * 0.2);
  });

  it('ships the capture runtime the browser export shoots frames with', () => {
    expect(baked(doc)).toContain(CAPTURE_REQUEST);
  });
});
