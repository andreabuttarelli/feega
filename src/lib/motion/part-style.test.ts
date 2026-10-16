// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { findClip, parseMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { FillType, fillsSchema } from './fill/model';
import { composeHtml } from './hyperframes/compose';
import { partStyleTag } from './hyperframes/part-styles';
import { Colouring, partColour, partFills, setPartFills } from './part-style';
import { TYPE_GRID_POSTER_TEMPLATE } from './template/type-grid-poster/template';
import { DARK_TAGS_POSTER_TEMPLATE } from './template/dark-tags-poster/template';
import type { OpResult } from './timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const customOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Custom') as MotionClip;
const solid = (color: string) => fillsSchema.parse([{ type: FillType.Solid, color }]);
const PINK = '#ff00aa';

describe('a text part whose colour every line shares', () => {
  const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
  const clip = customOf(doc);

  it('reads the shared type colour as its fill', () => {
    expect(partColour(doc, clip, 'lines:0')).toEqual({ key: 'ink', colouring: Colouring.Shared });
    expect(partFills(doc, clip, 'lines:0')).toEqual(solid(String(clip.props.ink)));
  });

  it('a new colour detaches into an override: the shared colour never moves', () => {
    const next = must(setPartFills(doc, clip.id, 'lines:0', solid(PINK)));
    const after = findClip(next, clip.id)!.clip;
    expect(after.props.ink).toBe(clip.props.ink);
    expect(after.partStyles).toEqual({ 'lines:0': { fills: solid(PINK) } });
    expect(partFills(next, after, 'lines:0')).toEqual(solid(PINK));
    expect(partFills(next, after, 'lines:1')).toEqual(solid(String(clip.props.ink)));
  });

  it('the override survives a save and a reload', () => {
    const next = must(setPartFills(doc, clip.id, 'lines:0', solid(PINK)));
    const reloaded = parseMotionDoc(JSON.parse(JSON.stringify(next)));
    expect(reloaded.ok && findClip(reloaded.doc, clip.id)!.clip.partStyles).toEqual({ 'lines:0': { fills: solid(PINK) } });
  });
});

describe('a text part with a colour of its own', () => {
  const doc = DARK_TAGS_POSTER_TEMPLATE.template.doc;
  const clip = customOf(doc);

  it('a plain colour writes its own field, no override', () => {
    expect(partColour(doc, clip, 'title')).toEqual({ key: 'titleColor', colouring: Colouring.Own });
    const after = findClip(must(setPartFills(doc, clip.id, 'title', solid(PINK))), clip.id)!.clip;
    expect(after.props.titleColor).toBe(PINK);
    expect(after.partStyles).toBeUndefined();
  });

  it('a gradient becomes an override', () => {
    const gradient = fillsSchema.parse([{ type: FillType.Linear, stops: [{ color: PINK, pos: 0 }, { color: '#00ffaa', pos: 1 }] }]);
    const after = findClip(must(setPartFills(doc, clip.id, 'title', gradient)), clip.id)!.clip;
    expect(after.partStyles?.title.fills).toEqual(gradient);
  });
});

describe('the override paints only its part', () => {
  const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
  const clip = customOf(doc);

  it('changes the colour of that part and of nothing else', () => {
    const after = findClip(must(setPartFills(doc, clip.id, 'lines:0', solid(PINK))), clip.id)!.clip;
    document.body.innerHTML =
      `<div data-clip="${clip.id}" style="color:#161616"><div data-part="lines:0"><span class="w">STUDIO</span></div><div data-part="lines:1"><span class="w">NAME</span></div><div class="stamp">ISSUE</div></div>` +
      partStyleTag([after], (c) => c, () => null);
    const colour = (selector: string) => getComputedStyle(document.querySelector(selector)!).color;
    expect(colour('[data-part="lines:0"] .w')).toBe('rgb(255, 0, 170)');
    expect(colour('[data-part="lines:1"] .w')).toBe('rgb(22, 22, 22)');
    expect(colour('.stamp')).toBe('rgb(22, 22, 22)');
  });

  it('an old doc composes exactly as before: no part styles, no style for them', () => {
    expect(partStyleTag([clip], (c) => c, () => null)).toBe('');
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });
    expect(html).not.toContain('[data-part=');
  });

  it('the composed page carries the scoped rule', () => {
    const next = must(setPartFills(doc, clip.id, 'lines:0', solid(PINK)));
    const html = composeHtml({ doc: next, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });
    expect(html).toContain(`[data-clip="${clip.id}"] [data-part="lines:0"]{color:${PINK} !important}`);
  });
});
