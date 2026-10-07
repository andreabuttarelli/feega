import { describe, expect, it } from 'vitest';
import { UI_KINDS, UI_KIT, type UiPiece } from './kit';

const DURATION = 4;
const TIMES = [0, 1.2, 3.9, 0.5, 2.4];

type Node = { tag: string; className: string; textContent: string; innerHTML: string; style: Record<string, unknown>; attrs: Record<string, string>; children: Node[] };

function node(tag: string): Node & Record<string, unknown> {
  const style: Record<string, unknown> = {};
  style.setProperty = (k: string, v: string) => (style[k] = v);
  const n = { tag, className: '', textContent: '', innerHTML: '', style, attrs: {} as Record<string, string>, children: [] as Node[], clientWidth: 1920, clientHeight: 1080 };
  return Object.assign(n, { appendChild: (c: Node) => n.children.push(c), setAttribute: (k: string, v: string) => (n.attrs[k] = v) });
}

const fakeDocument = { createElement: node, createElementNS: (_: string, tag: string) => node(tag) };

function mount(piece: UiPiece) {
  const root = node('root');
  const updates: (() => void)[] = [];
  let now = 0;
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const param = (_: string, fallback: unknown) => fallback;
  const tl = { to: (_: unknown, o: { onUpdate: (this: { time: () => number }) => void }) => updates.push(() => o.onUpdate.call({ time: () => now })) };
  new Function('root', 'param', 'tl', 'duration', 'rand', 'document', piece.js)(root, param, tl, DURATION, rand, fakeDocument);
  return (t: number) => {
    now = t;
    updates.forEach((u) => u());
    return JSON.stringify(root, (k, v) => (typeof v === 'function' ? undefined : v));
  };
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
});
