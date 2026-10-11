import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { writeComponent } from './custom/ops';
import { StoryBeat, markStory } from './story';
import { UI_KIT, UiKind } from './ui-kit/kit';
import { vectorPiece } from './vector-ui/piece';
import { VectorKind, VectorRole } from './vector-ui/model';
import { Quality, SEVERITY, Severity, docProblems } from './direction';
import { styleProblems } from './style';

const must = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withPiece = (doc: MotionDoc, piece: { name: string; html: string; css: string; js: string }) => must(addClip(must(writeComponent(doc, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } })), { component: 'Custom', from: 30, durationInFrames: 90, props: { name: piece.name } }, piece.name));

const productFilm = () => markStory(newMotionDoc(MotionFormat.Landscape), StoryBeat.Solution, 0);

const VECTOR = vectorPiece('UiFeega', { url: '', title: '', width: 1280, height: 800, background: '#fff', fonts: [], raster: [], nodes: [{ id: 'button-0', role: VectorRole.Button, kind: VectorKind.Box, x: 10, y: 10, w: 80, h: 30, fill: '#09f' }] });

const noUi = (doc: MotionDoc) => docProblems(doc, { audioAssets: 1 }).filter((p) => p.kind === Quality.NoProductUi);

describe('a product film must show the real product', () => {
  it('blocks a product film whose only UI is a generic kit card', () => {
    const doc = withPiece(productFilm(), UI_KIT[UiKind.CardGrid]);

    expect(noUi(doc)).toHaveLength(1);
    expect(SEVERITY[Quality.NoProductUi]).toBe(Severity.Blocking);
  });

  it('passes once the UI is rebuilt from the real product', () => {
    expect(noUi(withPiece(productFilm(), VECTOR))).toEqual([]);
  });

  it('leaves alone a video that tells no product story', () => {
    expect(noUi(withPiece(newMotionDoc(MotionFormat.Landscape), UI_KIT[UiKind.CardGrid]))).toEqual([]);
  });
});

describe('reading time never stretches a shot', () => {
  const titled = (text: string, seconds: number) => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: seconds * 30, props: { text } }, 't1'));

  it('asks to cut words when a line needs more than 4 s to be read', () => {
    const found = styleProblems(titled('If you can imagine it, you can do it.', 4)).find((p) => p.effect === 'reading-time');

    expect(found?.detail).toMatch(/cut it to 6 words/);
    expect(found?.detail).not.toMatch(/5\.2 s/);
  });

  it('still asks to hold a short line long enough to be read', () => {
    const found = styleProblems(titled('make your brand move', 1)).find((p) => p.effect === 'reading-time');

    expect(found?.detail).toMatch(/needs 3.2 s/);
  });
});
