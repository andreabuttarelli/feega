// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { FEEGA_TOKENS } from '../brand';
import { Space, cameraMath, stageSpec } from '../camera';
import { CameraPreset, applyPreset, setCamera, setClipDepth } from '../camera-ops';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { sampleTrack } from '../keyframes';
import { addClip, type OpResult } from '../timeline';
import { seekPlan } from '../custom/determinism';
import { composeHtml } from './compose';
import { STAGE_TIMELINE, stageScript } from './stage';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const flat = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 120 }, 'bg'));
  doc = must(addClip(doc, { component: 'Title', from: 0, durationInFrames: 120 }, 'title'));
  doc = must(addClip(doc, { component: 'Caption', from: 0, durationInFrames: 120 }, 'cap'));
  return { ...doc, durationInFrames: 120 };
})();

const staged = (() => {
  let doc = must(setClipDepth(flat, 'bg', { depth: 1500 }));
  doc = must(setClipDepth(doc, 'cap', { space: Space.Screen }));
  doc = must(setCamera(doc, { dof: true, base: { aperture: 3 } }));
  doc = must(applyPreset(doc, CameraPreset.DollyIn, { start: 0, duration: 90, amount: 500 }));
  return must(applyPreset(doc, CameraPreset.RackFocus, { start: 30, duration: 60, from: 'title', to: 'bg' }));
})();

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('the stage in the composition', () => {
  it('a doc without a camera keeps its flat layers', () => {
    const html = compose(flat);

    expect(html).not.toContain('id="world"');
    expect(html).not.toContain(STAGE_TIMELINE);
  });

  it('world clips go into one 3D world, screen clips stay above it, flat', () => {
    const html = compose(staged);
    const world = html.indexOf('<div id="world" class="world">');
    const worldEnd = html.indexOf('<!--/world-->');

    expect(world).toBeGreaterThan(0);
    expect(html.indexOf('data-clip="bg"')).toBeGreaterThan(world);
    expect(html.indexOf('data-clip="title"')).toBeLessThan(worldEnd);
    expect(html.indexOf('data-clip="cap"')).toBeGreaterThan(worldEnd);
  });

  it('a layer starts at its depth, scaled to keep its size at rest', () => {
    const spec = stageSpec(staged);
    const transform = cameraMath(sampleTrack).flatTransform(spec, 1500);

    expect(compose(staged)).toContain(`transform:${transform}`);
  });
});

function boot(doc: MotionDoc) {
  const spec = stageSpec(doc);
  document.body.innerHTML = `<div id="root"><div id="world">${spec.layers.map((l) => `<div class="layer" data-clip="${l.id}"></div>`).join('')}</div></div>`;
  const tl = gsap.timeline({ paused: true });
  const w = window as unknown as Record<string, unknown>;
  w.gsap = gsap;
  w.__timelines = { main: tl };
  window.eval(stageScript(spec, doc.fps, doc.durationInFrames / doc.fps));
  tl.set({}, {}, doc.durationInFrames / doc.fps);
  const read = () => ({
    perspective: document.getElementById('root')!.style.perspective,
    world: document.getElementById('world')!.style.transform,
    layers: spec.layers.map((l) => (document.querySelector(`[data-clip="${l.id}"]`) as HTMLElement).style.filter)
  });
  return { tl, spec, read };
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__timelines;
});

describe('the stage at runtime', () => {
  it('each frame shows the camera state the math gives for that frame', () => {
    const { tl, spec, read } = boot(staged);
    const math = cameraMath(sampleTrack);

    tl.totalTime(2, true);
    const state = math.frameAt(spec, 60);
    const shown = read();

    expect(shown.world).toBe(math.matrixCss(state.world));
    expect(shown.perspective).toBe(`${state.perspective}px`);
    expect(shown.layers).toEqual(state.layers.map((l) => (l.blur ? `blur(${l.blur}px)` : '')));
  });

  it('a seek gives the same frame from any direction (seek determinism)', () => {
    const { tl, read } = boot(staged);
    const shots = seekPlan(4, 30).map((t) => {
      tl.totalTime(t, true);
      return { t, shot: JSON.stringify(read()) };
    });

    const first = new Map<number, string>();
    for (const { t, shot } of shots) {
      expect(first.get(t) ?? shot).toBe(shot);
      first.set(t, shot);
    }
  });

  it('a layer in focus carries no filter at all', () => {
    const { tl, read } = boot(staged);

    tl.totalTime(0.5, true);

    expect(read().layers[1]).toBe('');
  });
});
