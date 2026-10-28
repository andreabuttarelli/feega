import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setExpression } from '@feega/motion-core/motion/expression/ops';
import { drawFrame, ItemKind, prepare, textCaretAt, type PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { apply2d } from '@feega/motion-core/motion/affine';
import { InputKey, type InputValues } from '@feega/motion-core/motion/expression/inputs';
import { liveFeed } from '@feega/motion-core/motion/interactive/gpu-live';
import { bindVar, declareVar, starterVar, VarKind, type VarValues } from '@feega/motion-core/motion/interactive/vars';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook } from '../gpu-full/text/test-face';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const FRAME_SECONDS = 1 / 60;
const WIDE = 1920;
const CARD_LEFT = 864;
const CARD_WIDTH = 192;

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' } }, 'card'));
const driven = (key: string, source: string) => must(setExpression(base, 'card', key, source));

function boxOf(doc: MotionDoc, values: InputValues, vars: VarValues = {}, frame = 0) {
  const feed = liveFeed({ doc, tokens: FEEGA_TOKENS, assets: {} })!;
  const shown = feed.apply(prepare(doc, FEEGA_TOKENS), frame, { values, vars }, FRAME_SECONDS);
  const item = drawFrame(shown, frame).items.find((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'card')!;
  const xs = item.contours.flatMap((c) => c.filter((_, k) => k % 2 === 0).map((x) => apply2d(item.matrix, [x, 0])[0]));
  return { left: Math.min(...xs), width: Math.max(...xs) - Math.min(...xs) };
}

describe('live input on gpu-core', () => {
  it('has nothing to drive when no expression reads input', () => {
    expect(liveFeed({ doc: base, tokens: FEEGA_TOKENS, assets: {} })).toBeNull();
  });

  it('hover moves the layer while the cursor is over the player', () => {
    const doc = driven('x', 'value + input.hover * 0.1');

    expect(boxOf(doc, {}).left).toBeCloseTo(CARD_LEFT);
    expect(boxOf(doc, { [InputKey.Hover]: 1 }).left).toBeCloseTo(CARD_LEFT + WIDE * 0.1);
  });

  it('the pointer position steers the layer', () => {
    const doc = driven('x', 'value + input.pointer.x - 0.5');

    expect(boxOf(doc, { [InputKey.PointerX]: 0.5, [InputKey.PointerY]: 0.5 }).left).toBeCloseTo(CARD_LEFT);
    expect(boxOf(doc, { [InputKey.PointerX]: 1, [InputKey.PointerY]: 0.5 }).left).toBeCloseTo(CARD_LEFT + WIDE * 0.5);
  });

  it('a press scales the layer', () => {
    const doc = driven('scale', 'value + input.pointer.down * 0.5');

    expect(boxOf(doc, {}).width).toBeCloseTo(CARD_WIDTH);
    expect(boxOf(doc, { [InputKey.PointerDown]: 1 }).width).toBeCloseTo(CARD_WIDTH * 1.5);
  });

  it('page scroll drives the layer', () => {
    const doc = driven('x', 'value + input.scroll * 0.2');

    expect(boxOf(doc, { [InputKey.Scroll]: 0 }).left).toBeCloseTo(CARD_LEFT);
    expect(boxOf(doc, { [InputKey.Scroll]: 1 }).left).toBeCloseTo(CARD_LEFT + WIDE * 0.2);
  });

  it('real time drives the layer', () => {
    const doc = driven('x', 'value + input.time * 0.1');

    expect(boxOf(doc, { [InputKey.Time]: 3 }).left).toBeCloseTo(CARD_LEFT + WIDE * 0.3);
  });

  it('a number variable set by the host page drives the layer', () => {
    const lift = must(declareVar(base, { name: 'lift', kind: VarKind.Number, default: 0, min: 0, max: 1 }));
    const declared = must(setExpression(lift, 'card', 'x', 'value + vars.lift'));

    expect(boxOf(declared, {}, { lift: 0 }).left).toBeCloseTo(CARD_LEFT);
    expect(boxOf(declared, {}, { lift: 0.25 }).left).toBeCloseTo(CARD_LEFT + WIDE * 0.25);
  });

  it('smoothing eases towards the target over several frames', () => {
    const doc = driven('x', 'value + input.smooth(input.pointer.x, 0.5) - 0.5');
    const feed = liveFeed({ doc, tokens: FEEGA_TOKENS, assets: {} })!;
    const first = prepare(doc, FEEGA_TOKENS);
    const left = (values: InputValues) => {
      const item = drawFrame(feed.apply(first, 0, { values, vars: {} }, FRAME_SECONDS), 0).items.find((i): i is PathItem => i.kind === ItemKind.Path)!;
      return apply2d(item.matrix, [item.contours[0][0], 0])[0];
    };

    left({ [InputKey.PointerX]: 0.5, [InputKey.PointerY]: 0.5 });
    const early = left({ [InputKey.PointerX]: 1, [InputKey.PointerY]: 0.5 });
    const later = Array.from({ length: 600 }, () => left({ [InputKey.PointerX]: 1, [InputKey.PointerY]: 0.5 })).at(-1)!;

    expect(early).toBeGreaterThan(CARD_LEFT);
    expect(early).toBeLessThan(later);
    expect(later).toBeCloseTo(CARD_LEFT + WIDE * 0.5, 0);
  });

  it('keeps the same prepared frame while nothing live changed', () => {
    const doc = driven('x', 'value + input.hover * 0.1');
    const feed = liveFeed({ doc, tokens: FEEGA_TOKENS, assets: {} })!;
    const prepared = prepare(doc, FEEGA_TOKENS);
    const a = feed.apply(prepared, 0, { values: {}, vars: {} }, FRAME_SECONDS);
    const b = feed.apply(prepared, 0, { values: {}, vars: {} }, FRAME_SECONDS);
    const c = feed.apply(prepared, 0, { values: { [InputKey.Hover]: 1 }, vars: {} }, FRAME_SECONDS);

    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });
});

describe('a variable bound to text', () => {
  const type = { fonts: boxBook(), smoothing: Smoothing.Plain };
  const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Hi', align: 'left', x: 0.1, width: 0.5 } }, 'title'));
  const bound = must(bindVar(must(declareVar(titled, starterVar(VarKind.String, 'label'))), { var: 'label', clip: 'title', prop: 'text' }));

  it('shows the value the host page sets, without a reload', () => {
    const feed = liveFeed({ doc: bound, tokens: FEEGA_TOKENS, assets: {} })!;
    const prepared = prepare(bound, FEEGA_TOKENS, {}, type);
    const text = (label: string) => textCaretAt(feed.apply(prepared, 0, { values: {}, vars: { label } }, FRAME_SECONDS), 0, 'title')!.text;

    expect(text('Buy now')).toBe('Buy now');
    expect(text('Sold out')).toBe('Sold out');
  });
});
