// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { Ease } from '../design';
import { MotionFormat, clipsOf, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { flattenComps, precompose } from '../precomp';
import { addClip, setKeyframes, setProps, type OpResult } from '../timeline';
import { isAnimatable } from '../keyframes';
import { bentoCellId } from '../bento/model';
import { composeHtml } from './compose';
import { bentoAt, bentoBake, bentoSlotAt, slotLocal } from './bento';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withComp = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 'kpi'));
  doc = must(precompose(doc, ['kpi'], { comp: 'dash', clip: 'pc' }, 'Dashboard'));
  doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== 'pc') })) };
  return { ...doc, durationInFrames: 150 };
})();

type Card = { assetId: string; kind: 'image' | 'video' | 'comp' } & Record<string, unknown>;

const bento = (media: Card[], layoutParams: Record<string, number | string> = {}) =>
  must(setProps(must(addClip(withComp, { component: 'Composition', from: 0, durationInFrames: 150 }, 'grid')), 'grid', { layout: 'bento', media, layoutParams: { columns: 3, rows: 2, ...layoutParams } }));

const compose = (doc: MotionDoc, assets: Record<string, string> = {}) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets });
const gridOf = (doc: MotionDoc) => clipsOf(doc).find((c) => c.id === 'grid') as MotionClip;
const ENV = { width: 1920, height: 1080, fps: 30 };

describe('a composition laid out as a bento', () => {
  it('plays a motion inside its cell, live: the composition becomes clips of the cell', () => {
    const ids = clipsOf(flattenComps(bento([{ assetId: 'dash', kind: 'comp' }]))).map((c) => c.id);

    expect(ids).toContain(`${bentoCellId('grid', 0)}__0__kpi`);
  });

  it('a cell shorter than the grid loops by default, or holds when asked', () => {
    const looped = clipsOf(flattenComps(bento([{ assetId: 'dash', kind: 'comp' }]))).filter((c) => c.id.endsWith('__kpi'));
    const held = clipsOf(flattenComps(bento([{ assetId: 'dash', kind: 'comp', timing: 'hold' }]))).filter((c) => c.id.endsWith('__kpi'));

    expect(looped.length).toBeGreaterThan(1);
    expect(held.map((c) => c.durationInFrames)).toEqual([150]);
  });

  it('refuses a cell that names a composition the video does not have', () => {
    expect(setProps(bento([]), 'grid', { media: [{ assetId: 'nope', kind: 'comp' }] })).toMatchObject({ ok: false, error: expect.stringContaining('no composition nope') });
  });

  it('draws each cell with its corner radius, fit, crop and colour, the motion inside its cell, and no WebGL stage', () => {
    const html = compose(
      bento([
        { assetId: 'dash', kind: 'comp' },
        { assetId: 'pic', kind: 'image', fit: 'contain', focusX: 0.2, focusY: 0.8, background: '#ff0000' }
      ]),
      { pic: 'https://cdn.example/pic.png' }
    );
    const cell = (i: number) => html.slice(html.indexOf(`id="bt-grid-${i}"`), html.indexOf(`id="bt-grid-${i + 1}"`));

    expect(cell(0)).toContain(`data-clip="${bentoCellId('grid', 0)}__0__kpi"`);
    expect(cell(0)).toContain('border-radius:24px');
    expect(cell(1)).toContain('https://cdn.example/pic.png');
    expect(cell(1)).toContain('object-fit:contain');
    expect(cell(1)).toContain('object-position:20% 80%');
    expect(cell(1)).toContain('background:#ff0000');
    expect(html).toContain('feegaBento');
    expect(html).not.toContain('id="comp-grid"');
  });

  it('keyframes the corner radius', () => {
    const doc = must(setKeyframes(bento([]), 'grid', 'cornerRadius', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 60, ease: Ease.Linear }]));
    const bake = bentoBake(gridOf(doc), ENV);

    expect(isAnimatable('Composition', 'cornerRadius')).toBe(true);
    expect(bentoAt(bake, 0).radius).toBe(0);
    expect(bentoAt(bake, 30).radius).toBe(60);
  });

  it('enters in a cascade: each cell starts after the one before, and all are in when it ends', () => {
    const bake = bentoBake(gridOf(bento([], { stagger: 0.2, enterSeconds: 0.5 })), ENV);
    const opacity = (frame: number) => bentoAt(bake, frame).cells.map((c) => c.opacity);

    expect(opacity(0).every((o) => o === 0)).toBe(true);
    expect(opacity(9)[0]).toBeGreaterThan(opacity(9)[1]);
    expect(opacity(9)[1]).toBeGreaterThan(opacity(9)[2]);
    expect(opacity(60).every((o) => o === 1)).toBe(true);
  });

  it('without an entrance every cell is in from the first frame', () => {
    const bake = bentoBake(gridOf(bento([], { enter: 'none' })), ENV);

    expect(bentoAt(bake, 0).cells.every((c) => c.opacity === 1 && c.transform === 'none')).toBe(true);
  });

  it('is the same frame whatever was seen before: a pose depends on the frame only', () => {
    const bake = bentoBake(gridOf(bento([], { stagger: 0.1 })), ENV);
    const direct = bentoAt(bake, 17);
    [40, 3, 99, 0].forEach((f) => bentoAt(bake, f));

    expect(bentoAt(bake, 17)).toEqual(direct);
  });

  it('maps a point of the frame into the local space of the motion in a cell, at any frame', () => {
    const doc = bento([{ assetId: 'dash', kind: 'comp' }], { columns: 2, rows: 2, gap: 20, enter: 'none' });
    const slot = bentoSlotAt(gridOf(doc), ENV, 0, 30)!;
    const centre = { x: slot.cell.left + slot.cell.width / 2, y: slot.cell.top + slot.cell.height / 2 };

    expect(slot.cell).toMatchObject({ left: 20, top: 20 });
    expect(slotLocal(slot, centre)).toEqual({ x: 960, y: 540 });
    expect(slotLocal(slot, { x: slot.cell.left, y: slot.cell.top }).x).toBe(0);
  });

  it('follows the cell while it rises in', () => {
    const doc = bento([{ assetId: 'dash', kind: 'comp' }], { enter: 'rise', stagger: 0, enterSeconds: 1 });
    const early = bentoSlotAt(gridOf(doc), ENV, 0, 5)!;
    const settled = bentoSlotAt(gridOf(doc), ENV, 0, 60)!;

    expect(early.content.y).toBeGreaterThan(settled.content.y);
    expect(bentoSlotAt(gridOf(doc), ENV, 7, 0)).toBeNull();
  });
});
