import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setCanvas, setTransform } from './timeline';
import { writeComponent } from './custom/ops';
import { addEffect } from './effects/ops';
import { EffectKind } from './effects/registry';
import { StoryBeat, markStory } from './story';
import { vectorPiece } from './vector-ui/piece';
import { VectorKind, VectorRole } from './vector-ui/model';
import { Quality, SEVERITY, Severity, docProblems, uiRecolour, uiShrink } from './direction';

const must = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const FPS = 30;

const screen = (name: string, text: string) => vectorPiece(name, { url: '', title: '', width: 1280, height: 800, background: '#fff', fonts: [], raster: [], nodes: [{ id: 'heading-0', role: VectorRole.Heading, kind: VectorKind.Text, x: 10, y: 10, w: 300, h: 40, text }] });

const EDITOR = screen('UiEditor', 'editor');
const CANVAS = screen('UiCanvas', 'canvas');

const film = (seconds: number) => markStory(must(setCanvas(newMotionDoc(MotionFormat.Portrait), { durationInFrames: seconds * FPS })), StoryBeat.Solution, 0);

function place(doc: MotionDoc, piece: { name: string; html: string; css: string; js: string }, from: number, seconds: number, id: string): MotionDoc {
  const written = doc.components[piece.name] ? doc : must(writeComponent(doc, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } }));
  return must(addClip(written, { component: 'Custom', from: from * FPS, durationInFrames: seconds * FPS, props: { name: piece.name } }, id));
}

const kinds = (doc: MotionDoc) => docProblems(doc, { audioAssets: 1 }).map((p) => p.kind);

describe('a product trailer is mostly the real app', () => {
  it('blocks a trailer where the app is on screen for less than half: the 14-04 eval showed it 3 s out of 29', () => {
    const doc = place(place(film(20), EDITOR, 2, 3, 'a'), CANVAS, 8, 3, 'b');

    expect(kinds(doc)).toContain(Quality.LittleUi);
    expect(SEVERITY[Quality.LittleUi]).toBe(Severity.Blocking);
  });

  it('blocks a trailer that shows one app screen only', () => {
    const doc = place(film(10), EDITOR, 0, 8, 'a');

    expect(kinds(doc)).toContain(Quality.OneScreen);
    expect(SEVERITY[Quality.OneScreen]).toBe(Severity.Blocking);
  });

  it('passes two screens over half the film', () => {
    const doc = place(place(film(12), EDITOR, 1, 4, 'a'), CANVAS, 6, 4, 'b');

    expect(kinds(doc)).not.toContain(Quality.LittleUi);
    expect(kinds(doc)).not.toContain(Quality.OneScreen);
  });

  it('leaves alone a video that tells no product story', () => {
    const doc = place(must(setCanvas(newMotionDoc(MotionFormat.Portrait), { durationInFrames: 20 * FPS })), EDITOR, 0, 2, 'a');

    expect(kinds(doc)).not.toContain(Quality.LittleUi);
  });
});

describe('the real app keeps its own colours and fills the frame', () => {
  const shown = () => place(place(film(12), EDITOR, 1, 4, 'a'), CANVAS, 6, 4, 'b');

  it('refuses a colour effect on the app: v5 tinted the editor into a negative', () => {
    expect(uiRecolour(shown(), 'a', EffectKind.Tint)).toMatch(/native colours/);
    expect(uiRecolour(shown(), 'a', EffectKind.BrightnessContrast)).toMatch(/native colours/);
    expect(uiRecolour(shown(), 'a', EffectKind.GaussianBlur)).toBeNull();
  });

  it('blocks a colour effect already on the app', () => {
    const doc = must(addEffect(shown(), 'a', EffectKind.Tint, 'fx1'));

    expect(kinds(doc)).toContain(Quality.RecolouredUi);
  });

  it('refuses shrinking the app below the frame', () => {
    expect(uiShrink(shown(), 'a', 70)).toMatch(/fill the frame/);
    expect(uiShrink(shown(), 'a', 130)).toBeNull();
  });

  it('blocks an app already shrunk', () => {
    const doc = must(setTransform(shown(), 'b', { scale: 0.6 }));

    expect(kinds(doc)).toContain(Quality.ShrunkUi);
  });

  it('lets a title card do what it likes', () => {
    const doc = must(addClip(shown(), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'hi' } }, 't'));

    expect(uiRecolour(doc, 't', EffectKind.Tint)).toBeNull();
    expect(uiShrink(doc, 't', 50)).toBeNull();
  });
});
