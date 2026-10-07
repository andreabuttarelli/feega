import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { anchorBox, cursorMisses, reelMisses, CURSOR_PIECE } from './clicks';
import { pieceAnchors, type Rect } from './ui-kit/anchors';
import { UI_KIT, UiKind } from './ui-kit/kit';
import { DEFAULT_REEL } from './ui-morph/reel';
import { addMorphReel } from './ui-morph/ops';
import { GOOGLE_FONTS } from './fonts/catalogue';

const FPS = 30;

function film(clips: MotionClip[], extra: Partial<MotionDoc> = {}): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Landscape);
  return { ...doc, fps: FPS, durationInFrames: 450, tracks: [{ id: 't1', kind: 'visual', name: 'V', clips }] as MotionDoc['tracks'], ...extra };
}

const promptBox = (props: Record<string, unknown> = {}, more: Partial<MotionClip> = {}) =>
  newClip({ id: 'prompt', from: 180, durationInFrames: 90, component: 'Custom', props: { name: 'UiPromptBox', label: 'Say what should change', prompt: 'Update the pricing page: free for personal use', ...props }, ...more });

const cursor = (path: string, from = 180, duration = 90) => newClip({ id: 'cursor', from, durationInFrames: duration, component: 'Custom', props: { name: CURSOR_PIECE, path } });

const centre = (b: { left: number; top: number; width: number; height: number }) => [b.left + b.width / 2, b.top + b.height / 2];

const MEASURED: { kind: UiKind; props: Record<string, unknown>; anchors: Record<string, [number, number, number, number]> }[] = [
  { kind: UiKind.LinkShortener, props: {}, anchors: { field: [-590, -59, 959, 78], button: [385, -59, 205, 76] } },
  { kind: UiKind.LinkShortener, props: { button: 'Shorten' }, anchors: { button: [420, -59, 170, 76] } },
  { kind: UiKind.Hero, props: {}, anchors: { cta: [-109, 92, 217, 74] } },
  { kind: UiKind.Hero, props: { headline: 'Every site you run, finally up to date in one calm place', sub: 'Describe the change in plain words. Supasito edits, previews and publishes it for you.', cta: 'Start free' }, anchors: { cta: [-95, 151, 190, 73] } },
  { kind: UiKind.PromptBox, props: {}, anchors: { field: [-620, -106, 1240, 176], send: [537, -13, 64, 64] } },
  { kind: UiKind.EditorCanvas, props: {}, anchors: { 'block-0': [-650, -280, 1302, 82], 'block-4': [20, 160, 632, 172] } },
  { kind: UiKind.CardGrid, props: {}, anchors: { 'card-0': [-720, -303, 461, 289], 'card-2': [259, -303, 461, 289], 'card-4': [-231, 14, 461, 289] } },
  { kind: UiKind.CardGrid, props: { cards: 'A|b\nC|d\nE|f' }, anchors: { 'card-0': [-720, -144, 461, 289] } },
  { kind: UiKind.Pricing, props: {}, anchors: { 'buy-0': [-685, 96, 391, 63], 'buy-2': [294, 96, 391, 63] } },
  { kind: UiKind.Pricing, props: { plans: 'Free|$0|1 site\nPro|$12|Unlimited sites; Custom domain; AI edits; Analytics; Priority' }, anchors: { 'buy-0': [-685, 135, 635, 63] } },
  { kind: UiKind.Modal, props: {}, anchors: { cancel: [109, -30, 130, 59], confirm: [254, -30, 137, 59] } },
  { kind: UiKind.Modal, props: { body: 'Your changes go live on your domain right away. Everyone with the link sees the new version, and the previous one stays in history.' }, anchors: { cancel: [109, 2, 130, 59] } },
  { kind: UiKind.Toggle, props: {}, anchors: { 'toggle-0': [420, -125, 80, 44], 'toggle-3': [420, 130, 80, 44] } },
  { kind: UiKind.Toggle, props: { settings: 'A\nB' }, anchors: { 'toggle-0': [420, -40, 80, 44] } },
  { kind: UiKind.Upload, props: {}, anchors: { drop: [-550, -180, 1100, 224] } },
  { kind: UiKind.Sidebar, props: {}, anchors: { 'nav-0': [-680, -308, 300, 58], 'nav-4': [-680, -76, 300, 58] } }
];

const TOLERANCE = 10;

const close = (got: Rect | undefined, want: [number, number, number, number]) => got && [got.x, got.y, got.w, got.h].every((v, i) => Math.abs(v - want[i]) <= TOLERANCE);

describe('UI anchors', () => {
  it.each(MEASURED.map((m, i) => [i, m] as const))('case %i: the anchor model matches the browser layout', (_, m) => {
    const placed = pieceAnchors(UI_KIT[m.kind].name, m.props);
    for (const [anchor, want] of Object.entries(m.anchors)) {
      expect(close(placed?.anchors[anchor], want), `${m.kind} ${anchor}: ${JSON.stringify(placed?.anchors[anchor])} vs ${want}`).toBe(true);
    }
  });

  it('places the send button at the frame centre plus its offset when the clip is untouched', () => {
    const box = anchorBox(film([promptBox()]), 'prompt', 'send', 200);

    expect(box && centre(box)[0]).toBeCloseTo(960 + 568.5, 0);
  });

  it('follows the clip scale, position and its parent', () => {
    const parent = newClip({ id: 'parent', from: 0, durationInFrames: 450, component: 'Null', props: {}, transform: { x: 0.1 } });
    const scaled = promptBox({}, { transform: { scale: 0.5 }, parent: 'parent' });
    const box = anchorBox(film([parent, scaled]), 'prompt', 'send', 200);

    expect(box && centre(box)[0]).toBeCloseTo(960 + 568.5 * 0.5 + 192, 0);
    expect(box?.width).toBeCloseTo(32, 0);
  });

  it('follows a keyframed scale at the frame asked', () => {
    const zooming = promptBox({}, { keyframes: { scale: [{ frame: 0, value: 0.5, ease: 'linear' }, { frame: 90, value: 1, ease: 'linear' }] as never } });

    expect(anchorBox(film([zooming]), 'prompt', 'send', 180)?.width).toBeCloseTo(32, 0);
    expect(anchorBox(film([zooming]), 'prompt', 'send', 269)?.width).toBeGreaterThan(60);
  });

  it('maps a clip inside a precomp through the precomp box and time', () => {
    const inner = promptBox({}, { from: 0 });
    const host = newClip({ id: 'host', from: 100, durationInFrames: 90, component: 'Precomp', props: { comp: 'c1', x: 0.25, y: 0.25, width: 0.5, height: 0.5 } });
    const doc = film([host], { comps: { c1: { name: 'C', durationInFrames: 90, tracks: [{ id: 'ct', kind: 'visual', name: 'V', clips: [inner] }] } } as never });
    const box = anchorBox(doc, 'prompt', 'send', 120);

    expect(box && centre(box)[0]).toBeCloseTo((960 + 568.5) / 2 + 0, 0);
  });

  it('projects through a camera dolly: closer means larger', () => {
    const doc = film([promptBox()], { camera: { base: { z: 300 }, keyframes: {}, dof: false } as never });
    const box = anchorBox(doc, 'prompt', 'send', 200);

    expect(box?.width).toBeGreaterThan(64);
  });
});

describe('click-miss', () => {
  it('names the supasito v2 click that landed left of the send button', () => {
    const doc = film([promptBox({}, { keyframes: { scale: [{ frame: 0, value: 0.92, ease: 'linear' }, { frame: 90, value: 1, ease: 'linear' }] as never } }), cursor(`${1455 / 1920}|${557 / 1080}|1.85|prompt#send`)]);

    expect(cursorMisses(doc).map((m) => m.clipId)).toEqual(['cursor']);
    expect(cursorMisses(doc)[0].detail).toContain('send');
  });

  it('passes a click aimed at the send anchor', () => {
    const base = film([promptBox()]);
    const send = anchorBox(base, 'prompt', 'send', 180 + 55)!;
    const [x, y] = centre(send);

    expect(cursorMisses(film([promptBox(), cursor(`${x / 1920}|${y / 1080}|1.85|prompt#send`)]))).toEqual([]);
  });

  it('names a click with no UI on screen', () => {
    expect(cursorMisses(film([cursor('0.5|0.5|1')], {}))[0].detail).toContain('no clickable UI');
  });

  it('keeps every press of the UI morph reel inside the shape it presses', () => {
    const made = addMorphReel(newMotionDoc(MotionFormat.Square), { states: DEFAULT_REEL, bpm: 120, offset: 0, pace: 2, props: {} }, GOOGLE_FONTS, 'reel');

    expect(made.ok && reelMisses(made.doc).filter((m) => m.detail.includes('presses'))).toEqual([]);
  });

  it('never leaves the reel cursor parked under the UI, as it was between the toast and the button', () => {
    const made = addMorphReel(newMotionDoc(MotionFormat.Square), { states: DEFAULT_REEL, bpm: 120, offset: 0, pace: 2, props: {} }, GOOGLE_FONTS, 'reel');

    expect(made.ok && reelMisses(made.doc)).toEqual([]);
  });
});
