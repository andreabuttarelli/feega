import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { drawPiece } from '../ui-kit/render';
import { writeComponent } from '../custom/ops';
import { MAX_JS } from '../custom/component';
import { lintSource } from '../custom/lint';
import { addMarker } from '../organize';
import { pieceAnchors } from '../ui-kit/anchors';
import { vectorPiece } from '../vector-ui/piece';
import { VectorKind, VectorRole, type VectorNode, type VectorUi } from '../vector-ui/model';
import { SHOTS, SHOT_IDS, ShotId, ShotUi, shotSource } from './library';
import { addShot, shotComponent } from './ops';

const node = (id: string, role: VectorRole, kind: VectorKind, x: number, y: number, w: number, h: number, extra: Partial<VectorNode> = {}): VectorNode => ({ id, role, kind, x, y, w, h, ...extra });

const UI: VectorUi = {
  url: 'https://feega.test/app',
  title: 'feega',
  width: 1280,
  height: 800,
  background: 'rgb(250, 250, 248)',
  fonts: ['DM Sans'],
  raster: [],
  nodes: [
    node('heading-0', VectorRole.Heading, VectorKind.Text, 576, 185, 348, 75, { text: 'make a video.', size: 64, color: 'rgb(0, 0, 0)', font: 'DM Sans' }),
    node('input-0', VectorRole.Input, VectorKind.Box, 407, 307, 686, 56, { fill: 'rgb(255, 255, 255)', stroke: '1px solid rgb(229, 229, 229)' }),
    node('input-1', VectorRole.Input, VectorKind.Text, 420, 325, 300, 18, { text: 'Paste your website', size: 15, color: 'rgb(140, 140, 140)' }),
    node('button-0', VectorRole.Button, VectorKind.Box, 1053, 371, 40, 40, { fill: 'rgb(0, 153, 255)', r: '9999px' }),
    node('button-1', VectorRole.Button, VectorKind.Box, 599, 440, 99, 32, { stroke: '1px solid rgb(229, 229, 229)' }),
    node('stat-0', VectorRole.Stat, VectorKind.Text, 200, 600, 80, 30, { text: '12,400', size: 28 })
  ]
};

const SLOTS: Record<ShotId, Record<string, unknown>> = {
  [ShotId.KineticTitle]: { text: 'make your brand move.' },
  [ShotId.DeviceFlyIn]: {},
  [ShotId.UiFocus]: { field_id: 'input-0', button_id: 'button-0', type_text: 'a launch film' },
  [ShotId.FeatureGrid]: { items: 'a|b|c' },
  [ShotId.StatCount]: { value: '12,400', label: 'videos' },
  [ShotId.BeforeAfter]: { before_text: 'three weeks' },
  [ShotId.LogoResolve]: { wordmark: 'feega', url: 'feega.app' },
  [ShotId.UiMorph]: { from_id: 'input-0', to_id: 'button-0' },
  [ShotId.TaglineCard]: { lines: 'make your brand|move.' },
  [ShotId.WhipZoom]: { target_id: 'button-0' }
};

const TIMES = [0, 1.3, 3.1, 0.4, 2.2];
const DURATION = 3.5;

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === 'function' ? undefined : x));

function seeker(id: ShotId) {
  const draw = drawPiece(shotSource(id, UI).js, SLOTS[id], DURATION);
  return (t: number) => json(draw(t));
}

function withUi(): MotionDoc {
  const piece = vectorPiece('UiFeega', UI);
  const made = writeComponent(newMotionDoc(MotionFormat.Landscape), piece.name, { source: { html: '', css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

describe('every shot of the library', () => {
  it.each(SHOT_IDS.map((s) => [s]))('%s draws the same frame for a time whatever time came before', (id) => {
    const seek = seeker(id);
    const first = TIMES.map(seek);
    const again = [...TIMES].reverse().map(seek).reverse();

    expect(again).toEqual(first);
  });

  it.each(SHOT_IDS.map((s) => [s]))('%s moves: its first and last frames differ', (id) => {
    const seek = seeker(id);

    expect(seek(0)).not.toEqual(seek(DURATION));
  });

  it.each(SHOT_IDS.map((s) => [s]))('%s passes the authoring contract and fits the code budget', (id) => {
    const source = shotSource(id, UI);

    expect(lintSource(source)).toEqual([]);
    expect(source.js.length).toBeLessThanOrEqual(MAX_JS);
  });

  it.each(SHOT_IDS.map((s) => [s]))('%s keeps to the pace: 4 s at most, 2 s at least unless it is a transition', (id) => {
    const { min, best, max } = SHOTS[id].seconds;

    expect(max).toBeLessThanOrEqual(4);
    expect(min).toBeLessThanOrEqual(best);
    expect(best).toBeLessThanOrEqual(max);
  });
});

describe('add_shot', () => {
  it('places a shot as an ordinary clip whose slots are its editable props', () => {
    const made = addShot(withUi(), { shot: ShotId.UiFocus, slots: SLOTS[ShotId.UiFocus], ui: 'UiFeega', at: 1 }, 'c1');

    expect(made.ok).toBe(true);
    const clip = made.ok ? made.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'c1') : null;
    expect(clip?.props).toMatchObject({ name: shotComponent(ShotId.UiFocus, 'UiFeega'), field_id: 'input-0', type_text: 'a launch film' });
    expect(clip?.from).toBe(30);
  });

  it('refuses a slot the shot does not have and names the ones it has', () => {
    const made = addShot(withUi(), { shot: ShotId.KineticTitle, slots: { text: 'hi', colour: 'red' }, at: 0 }, 'c1');

    expect(made.ok ? '' : made.error).toMatch(/text.*accent_word/);
  });

  it('refuses a UI shot without a recreated UI', () => {
    const made = addShot(newMotionDoc(MotionFormat.Landscape), { shot: ShotId.DeviceFlyIn, slots: {}, at: 0 }, 'c1');

    expect(made.ok ? '' : made.error).toMatch(/recreate_ui/);
  });

  it('refuses an element the UI does not have and lists the ones it does', () => {
    const made = addShot(withUi(), { shot: ShotId.WhipZoom, slots: { target_id: 'button-9' }, ui: 'UiFeega', at: 0 }, 'c1');

    expect(made.ok ? '' : made.error).toMatch(/button-9.*button-0/);
  });

  it('never stretches a shot past 4 s to make room for words', () => {
    const made = addShot(withUi(), { shot: ShotId.KineticTitle, slots: { text: 'a very long line of words to read' }, at: 0, seconds: 6 }, 'c1');

    expect(made.ok ? '' : made.error).toMatch(/cut the words/);
  });

  it('starts and ends on the beat grid when the music has beats marked', () => {
    let doc = withUi();
    for (const [i, s] of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].entries()) {
      const marked = addMarker(doc, { frame: Math.round(s * doc.fps), label: `beat ${i + 1}` });
      doc = marked.ok ? marked.doc : doc;
    }

    const made = addShot(doc, { shot: ShotId.TaglineCard, slots: SLOTS[ShotId.TaglineCard], at: 0.95, seconds: 2.7 }, 'c1');

    expect(made.ok && made.placed).toEqual({ from: 30, frames: 75, snapped: true });
  });

  it('writes a shot component once and reuses it for the next clip', () => {
    const first = addShot(withUi(), { shot: ShotId.StatCount, slots: SLOTS[ShotId.StatCount], at: 0 }, 'c1');
    const second = first.ok ? addShot(first.doc, { shot: ShotId.StatCount, slots: { value: '9', label: 'x' }, at: 3 }, 'c2') : first;

    expect(second.ok && Object.keys(second.doc.components).filter((k) => k.startsWith('ShotStatCount'))).toEqual(['ShotStatCount']);
  });

  it('every UI shot carries the UI it was given, every other shot none', () => {
    for (const id of SHOT_IDS) {
      expect(shotSource(id, UI).js.includes('const U = ')).toBe(SHOTS[id].ui === ShotUi.Required);
    }
  });
});

describe('a recreated vector UI', () => {
  it('exposes every element as an anchor at its real box, for focus_ui and click_ui', () => {
    const piece = vectorPiece('UiFeega', UI);

    const placed = pieceAnchors('UiFeega', {}, piece.js);

    expect(placed?.size).toEqual({ width: 1280, height: 800 });
    expect(placed?.anchors['button-0']).toEqual({ x: 1053 - 640, y: 371 - 400, w: 40, h: 40 });
  });

  it('draws the same frame for a time whatever time came before, typing and counting included', () => {
    const draw = drawPiece(vectorPiece('UiFeega', UI).js, { type_id: 'input-1', type_text: 'hello', count_id: 'stat-0', press_id: 'button-0' }, DURATION);
    const seek = (t: number) => json(draw(t));
    const first = TIMES.map(seek);

    expect([...TIMES].reverse().map(seek).reverse()).toEqual(first);
  });
});
