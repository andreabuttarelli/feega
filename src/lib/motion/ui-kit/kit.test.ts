import { describe, expect, it } from 'vitest';
import { UI_KINDS, UI_KIT, type UiPiece } from './kit';
import { drawPiece, placeholders } from './render';
import { skeletons } from './content';

const DURATION = 4;
const TIMES = [0, 1.2, 3.9, 0.5, 2.4];

function mount(piece: UiPiece) {
  const draw = drawPiece(piece.js, {}, DURATION);
  return (t: number) => JSON.stringify(draw(t), (k, v) => (typeof v === 'function' ? undefined : v));
}

describe('every UI kit piece', () => {
  it.each(UI_KINDS.map((k) => [k]))('%s draws the same frame for a time whatever time came before', (kind) => {
    const seek = mount(UI_KIT[kind]);
    const first = TIMES.map(seek);
    const again = [...TIMES].reverse().map(seek).reverse();

    expect(again).toEqual(first);
  });

  it.each(UI_KINDS.map((k) => [k]))('%s moves: its first and last frames differ', (kind) => {
    const seek = mount(UI_KIT[kind]);

    expect(seek(0)).not.toEqual(seek(DURATION - 0.1));
  });

  it.each(UI_KINDS.map((k) => [k]))('%s reacts on springs: presses, hovers and switches never ride an eased ramp', (kind) => {
    const js = UI_KIT[kind].js;

    expect(js).not.toMatch(/span\(t, CLICK, 0\.08\)|inOut\(span\(t, HOVER|const on = inOut|lift = i === top \? out|const press = \(t, at\) => span/);
  });

  it.each(UI_KINDS.map((k) => [k]))('%s never redeclares a name the runtime passes in, such as brand, or a browser global that cannot be shadowed, such as top', (kind) => {
    expect(UI_KIT[kind].js).not.toMatch(/^(const|let) (root|props|tl|param|duration|fps|assets|brand|rand|motion|gsap|lottie|THREE|top|window|document|location)\b/m);
  });

  it.each(UI_KINDS.map((k) => [k]))('%s never leaves grey placeholder rows or shape-only cards on screen once it has loaded', (kind) => {
    expect(skeletons(UI_KIT[kind].name, {}, DURATION)).toEqual([]);
  });
});

describe('placeholders', () => {
  const box = (className: string, text = '', children: ReturnType<typeof row>[] = []) => ({ tag: 'div', className, textContent: text, innerHTML: '', style: {}, attrs: {}, children });
  const row = (text = '') => box('bar', '', [box('chip'), box('stroke', text)]);

  it('names three or more rows with no text, and a card with only shapes', () => {
    expect(placeholders(box('main', '', [row(), row(), row()]))).toEqual(['3 rows "bar" with no text']);
    expect(placeholders(box('card pic', '', [box('shape')]))).toEqual(['a card "card pic" with only shapes']);
  });

  it('lets rows with text and short lists through', () => {
    expect(placeholders(box('main', '', [row('Home'), row('Pricing'), row('Blog')]))).toEqual([]);
    expect(placeholders(box('main', '', [row(), row()]))).toEqual([]);
  });
});

