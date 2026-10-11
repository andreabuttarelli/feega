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
import { ShotId } from './shots/library';
import { addShot, type ShotPlan } from './shots/ops';
import FEEGA_APP from './shots/fixtures/feega-app-vector.json';
import type { VectorUi } from './vector-ui/model';

const APP = vectorPiece('UiApp', FEEGA_APP as unknown as VectorUi);

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

describe('the real app fills the frame where it is drawn', () => {
  const vertical = (seconds: number) => markStory(must(setCanvas(newMotionDoc(MotionFormat.Vertical), { durationInFrames: seconds * FPS })), StoryBeat.Solution, 0);
  const shot = (doc: MotionDoc, plan: ShotPlan, id: string) => {
    const made = addShot(doc, plan, id);
    if (!made.ok) {
      throw new Error(made.error);
    }
    return made.doc;
  };
  const withApp = (doc: MotionDoc) => must(writeComponent(doc, APP.name, { source: { html: APP.html, css: APP.css, js: APP.js }, propsSchema: { type: 'object', properties: {} } }));
  const focus = (doc: MotionDoc, at: number, id: string) => shot(doc, { shot: ShotId.UiFocus, ui: APP.name, at, seconds: 4, slots: { field_id: 'input-0', button_id: 'button-5' } }, id);
  const device = (doc: MotionDoc, at: number, id: string) => shot(doc, { shot: ShotId.DeviceFlyIn, ui: APP.name, at, seconds: 2.5, slots: {} }, id);

  it('passes ui-focus shots, which keep the app over the whole frame', () => {
    expect(kinds(focus(focus(withApp(vertical(12)), 0, 'a'), 5, 'b'))).not.toContain(Quality.SmallUi);
  });

  it('allows one device moment and blocks a second: v2 showed the app small on black', () => {
    const one = device(withApp(vertical(12)), 0, 'a');

    expect(kinds(one)).not.toContain(Quality.SmallUi);
    expect(kinds(device(one, 4, 'b'))).toContain(Quality.SmallUi);
    expect(SEVERITY[Quality.SmallUi]).toBe(Severity.Blocking);
  });

  it('blocks an app shot shrunk by its clip scale', () => {
    const doc = must(setTransform(focus(withApp(vertical(12)), 0, 'a'), 'a', { scale: 0.5 }));

    expect(kinds(doc)).toContain(Quality.SmallUi);
  });
});
