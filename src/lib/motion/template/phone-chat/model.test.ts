import { describe, expect, it } from 'vitest';
import { CHAT_MODEL } from './model';

type Message = { name: string; text: string };
type Bubble = { slot: number; morph: number; text: number; dots: number[] };
type Frame = { camera: number; fade: number; scroll: number; bubbles: Bubble[] };
type Layout = { phoneW: number; phoneH: number; top: number };
type Model = {
  parseMessages: (raw: string) => Message[];
  chatLayout: (p: object, m: { frameW: number; frameH: number }) => Layout;
  chatTimes: (p: object, count: number, length: number) => { typingAt: number[]; showAt: number[]; outAt: number };
  chatFrame: (p: object, t: number, length: number, overflow: number[]) => Frame;
};

const model = new Function(`${CHAT_MODEL}; return { parseMessages, chatLayout, chatTimes, chatFrame };`)() as Model;

const PARAMS = { phoneSize: 1, phoneTop: 0.06, startAt: 0.6, every: 1.3, typingSeconds: 0.7, push: 0.08, outSeconds: 1.2, leave: true };
const LENGTH = 9;
const FPS = 30;
const OVERFLOW = [0, 0, 0, 1.5, 2];

const frames = (p: object = PARAMS, overflow = OVERFLOW) => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => model.chatFrame(p, i / FPS, LENGTH, overflow));

describe('the phone chat messages', () => {
  it('reads one "name | text" message per line, skipping blank lines', () => {
    expect(model.parseMessages('Mara | hi there\n\n  Theo|  sure \nno name here')).toEqual([
      { name: 'Mara', text: 'hi there' },
      { name: 'Theo', text: 'sure' },
      { name: '', text: 'no name here' }
    ]);
  });

  it('keeps a "|" inside the text', () => {
    expect(model.parseMessages('Mara | a | b')).toEqual([{ name: 'Mara', text: 'a | b' }]);
  });
});

describe('the phone chat layout', () => {
  it('fits the phone width inside a portrait frame and starts it near the top', () => {
    const layout = model.chatLayout(PARAMS, { frameW: 1080, frameH: 1920 });

    expect(layout.phoneW).toBeLessThan(1080);
    expect(layout.top).toBeCloseTo(1920 * PARAMS.phoneTop, 9);
    expect(layout.phoneH).toBeCloseTo(layout.phoneW / 0.486, 6);
  });

  it('shows a close-up in landscape: the phone runs past the bottom edge', () => {
    const layout = model.chatLayout(PARAMS, { frameW: 1920, frameH: 1080 });

    expect(layout.top + layout.phoneH).toBeGreaterThan(1080);
    expect(layout.phoneW / 1920).toBeGreaterThan(0.4);
  });
});

describe('the phone chat timeline', () => {
  it('types before it shows each message, one after the other', () => {
    const times = model.chatTimes(PARAMS, 5, LENGTH);

    times.showAt.forEach((at, i) => {
      expect(at).toBeGreaterThan(times.typingAt[i]);
      expect(at).toBeLessThanOrEqual(times.typingAt[i + 1] ?? Infinity);
    });
  });

  it('squeezes a long list so the last message lands before the loop closes', () => {
    const times = model.chatTimes(PARAMS, 12, LENGTH);

    expect(times.showAt[11]).toBeLessThan(times.outAt - 0.5);
  });

  it('hides the text while typing, then reveals it', () => {
    const times = model.chatTimes(PARAMS, OVERFLOW.length, LENGTH);
    const typing = model.chatFrame(PARAMS, (times.typingAt[1] + times.showAt[1]) / 2, LENGTH, OVERFLOW).bubbles[1];
    const shown = model.chatFrame(PARAMS, times.showAt[1] + 1, LENGTH, OVERFLOW).bubbles[1];

    expect(typing.text).toBe(0);
    expect(Math.max(...typing.dots)).toBeGreaterThan(0);
    expect(shown.text).toBe(1);
    expect(shown.morph).toBe(1);
    expect(Math.max(...shown.dots)).toBe(0);
  });

  it('starts empty and closes the loop on the same frame', () => {
    const all = frames();
    const [first, last] = [all[0], all[all.length - 1]];

    expect(first.camera).toBe(1);
    expect(last.camera).toBeCloseTo(1, 9);
    first.bubbles.forEach((b) => expect(b.slot).toBe(0));
    expect(last.fade).toBeCloseTo(0, 9);
  });

  it('pushes the camera in without overshoot', () => {
    const all = frames();
    const peak = all.findIndex((f) => f.camera === Math.max(...all.map((g) => g.camera)));

    all.slice(1, peak + 1).forEach((f, i) => expect(f.camera).toBeGreaterThanOrEqual(all[i].camera));
    all.forEach((f) => expect(f.camera).toBeLessThanOrEqual(1 + PARAMS.push + 1e-9));
    all.forEach((f) => expect(f.camera).toBeGreaterThanOrEqual(1));
  });

  it('scrolls only by the overflow of the shown messages, never back while they stay', () => {
    const all = frames();
    const times = model.chatTimes(PARAMS, OVERFLOW.length, LENGTH);
    const held = all.filter((_, i) => i / FPS < times.outAt);

    expect(model.chatFrame(PARAMS, times.typingAt[3] - 0.01, LENGTH, OVERFLOW).scroll).toBe(0);
    expect(model.chatFrame(PARAMS, times.outAt - 0.01, LENGTH, OVERFLOW).scroll).toBeCloseTo(3.5, 9);
    held.slice(1).forEach((f, i) => expect(f.scroll).toBeGreaterThanOrEqual(held[i].scroll));
  });

  it('without loop, holds the full chat on the last frame', () => {
    const last = model.chatFrame({ ...PARAMS, leave: false }, LENGTH, LENGTH, OVERFLOW);

    expect(last.fade).toBe(1);
    last.bubbles.forEach((b) => expect(b.text).toBe(1));
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.4, 2.1, 3.3, 6.2, 8.9];
    const forward = at.map((t) => model.chatFrame(PARAMS, t, LENGTH, OVERFLOW));
    const backward = [...at].reverse().map((t) => model.chatFrame(PARAMS, t, LENGTH, OVERFLOW)).reverse();

    expect(backward).toEqual(forward);
  });
});
