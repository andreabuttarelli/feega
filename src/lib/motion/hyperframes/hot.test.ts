// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, setCanvas, setProps, setTrackMatte, setTransform, type OpResult } from '../timeline';
import { setCamera, setClipDepth } from '../camera-ops';
import { writeComponent } from '../custom/ops';
import { stageSpec } from '../camera';
import { installEngine, testTimeline } from '../engine/testing';
import { particleScript } from './particles';
import { stageScript } from './stage';
import { shapeScript } from './shapes';
import { TrackKind, type ComponentId } from '../components';
import { Matte } from '../mask';
import { MATTE_RUNTIME } from './mattes';
import { composeHtml } from './compose';
import { GL_GLOBAL, HOT_PATCH, hotPatch, keptGl, type HotPatch } from './hot';

function must(r: OpResult | { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hi' } }, 't'));
const html = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {} });
const patchScripts = (page: string) => [...page.matchAll(/<script data-hot>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('hot patching the preview', () => {
  it('cambiare l’opacità non ricompone: the change travels as a patch of #root and the timeline', () => {
    const next = must(setTransform(base, 't', { opacity: 0.3 }));
    const patch = hotPatch(html(base), html(next));

    expect(patch?.type).toBe(HOT_PATCH);
    expect(patch?.root).toContain('data-clip="t"');
    expect(patch?.scripts.join('')).toContain('0.3');
  });

  it('changing the text patches too', () => {
    const next = must(addClip(base, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'u'));

    expect(hotPatch(html(base), html(next))?.root).toContain('Two');
  });

  it('a change outside #root and the timeline reloads: the length', () => {
    const longer = must(setCanvas(base, { durationInFrames: 90 }));

    expect(hotPatch(html(base), html(longer))).toBeNull();
  });

  describe('a clip with a track matte', () => {
    const stacked = must(addClip(must(addTrack(base, TrackKind.Visual, 'top')), { component: 'Title', from: 0, durationInFrames: 60, trackId: 'top', props: { text: 'GO' } }, 'src'));
    const matted = must(setTrackMatte(stacked, 't', Matte.Alpha));

    it('patches, and the patch restarts the matte runtime', () => {
      const patch = hotPatch(html(matted), html(must(setTransform(matted, 'src', { opacity: 0.5 }))));

      expect(patch?.scripts.some((s) => s.includes(MATTE_RUNTIME))).toBe(true);
    });

    it('a restarted matte runtime replaces the old one instead of piling up', () => {
      const script = patchScripts(html(matted)).find((s) => s.includes(MATTE_RUNTIME))!;
      const listeners: string[] = [];
      const tweens: unknown[] = [];
      const timeline = { to: (...args: unknown[]) => tweens.push(args), clear: () => tweens.splice(0) };
      const win: Record<string, unknown> = { __timelines: { main: timeline }, htmlToImage: {} };
      const run = () =>
        new Function('window', 'document', 'addEventListener', 'removeEventListener', script)(
          win,
          { getElementById: () => null, querySelector: () => null },
          (type: string) => listeners.push(type),
          (type: string) => listeners.splice(listeners.indexOf(type), 1)
        );

      run();
      timeline.clear();
      run();

      expect(listeners).toEqual(['hf-seek']);
      expect(tweens).toHaveLength(1);
    });
  });

  it('the same document needs nothing', () => {
    expect(hotPatch(html(base), html(base))).toBeNull();
  });
});

const sourceOf = (patch: HotPatch | null) => [...(patch?.scripts ?? []), ...(patch?.modules ?? [])].join('');

describe('changing a prop patches every kind of clip instead of reloading', () => {
  const withClip = (component: ComponentId, props: Record<string, unknown> = {}) => must(addClip(newMotionDoc(MotionFormat.Square), { component, from: 0, durationInFrames: 60, props }, 'k'));

  it('cambiare una prop di Text3D non ricarica', () => {
    const text = withClip('Text3D', { text: 'Hello' });
    const patch = hotPatch(html(text), html(must(setProps(text, 'k', { text: 'World' }))));

    expect(patch?.type).toBe(HOT_PATCH);
    expect(sourceOf(patch)).toContain('"text":"World"');
  });

  it('cambiare una prop di Shape3D non ricarica', () => {
    const shape = withClip('Shape3D');

    expect(sourceOf(hotPatch(html(shape), html(must(setProps(shape, 'k', { shape: 'sphere' })))))).toContain('"shape":"sphere"');
  });

  it('cambiare una prop delle particelle non ricarica', () => {
    const particles = withClip('Particles');

    expect(hotPatch(html(particles), html(must(setProps(particles, 'k', { seed: 7 }))))?.type).toBe(HOT_PATCH);
  });

  it('cambiare una prop di Composition non ricarica', () => {
    const composition = withClip('Composition');

    expect(sourceOf(hotPatch(html(composition), html(must(setProps(composition, 'k', { loop: 3 })))))).toContain('"loopFrames":90');
  });

  it('cambiare una prop di un componente custom non ricarica', () => {
    const spec = {
      source: { html: '<div class="dot"></div>', css: '', js: 'tl.to(root.querySelector(".dot"),{x:param("shift",0),duration:1});' },
      propsSchema: { type: 'object' as const, properties: { shift: { type: 'number' as const, default: 0 } } }
    };
    const custom = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Square), 'Dot', spec)), { component: 'Custom', from: 0, durationInFrames: 60, props: { name: 'Dot', shift: 10 } }, 'k'));

    expect(sourceOf(hotPatch(html(custom), html(must(setProps(custom, 'k', { shift: 40 })))))).toContain('"shift":40');
  });

  it('cambiare la camera non ricarica', () => {
    const staged = must(setCamera(must(setClipDepth(base, 't', { depth: 400 })), { dof: true }));
    const patch = hotPatch(html(staged), html(must(setCamera(staged, { base: { fov: 30 } }))));

    expect(patch?.type).toBe(HOT_PATCH);
    expect(patch?.root).toContain('id="world"');
  });
});

describe('a script run again by a patch replaces its previous run', () => {
  const seekListeners = (run: () => void) => {
    const live = new Set<EventListenerOrEventListenerObject>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions) => {
      if (type === 'hf-seek') {
        live.add(fn);
      }
      add(type, fn, o);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: EventListenerOptions) => {
      live.delete(fn);
      remove(type, fn, o);
    }) as typeof window.removeEventListener;
    try {
      run();
      run();
    } finally {
      window.addEventListener = add;
      window.removeEventListener = remove;
    }
    return live.size;
  };
  const strip = (tag: string) => tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const timeline = () => {
    const w = window as unknown as Record<string, unknown>;
    w.__timelines = { main: testTimeline(installEngine()) };
  };

  it('particles', () => {
    timeline();
    const script = strip(particleScript([{ id: 'p' } as never], 30, 2));

    expect(seekListeners(() => window.eval(script))).toBe(1);
  });

  it('the camera stage', () => {
    timeline();
    const staged = must(setCamera(must(setClipDepth(base, 't', { depth: 400 })), {}));
    document.body.innerHTML = '<div id="root"><div id="world"><div class="layer" data-clip="t"></div></div></div>';
    const script = stageScript(stageSpec(staged), 30, 2);

    expect(seekListeners(() => window.eval(script))).toBe(1);
  });

  it('shapes', () => {
    timeline();
    const script = strip(shapeScript([{ id: 's', from: 0, index: [0], frames: [''] } as never], 30, 2));

    expect(seekListeners(() => window.eval(script))).toBe(1);
  });
});

describe('the WebGL renderer survives a patch', () => {
  it('a renderer drawing below output resolution is reused, not rebuilt', () => {
    const made: object[] = [];
    const kept = new Function('document', 'window', `${keptGl()};return keptRenderer;`)(document, window) as (id: string, make: (c: HTMLCanvasElement) => object) => object;
    const make = (canvas: HTMLCanvasElement) => {
      const r = { canvas, setRenderTarget: () => undefined, dispose: () => undefined, forceContextLoss: () => undefined };
      made.push(r);
      canvas.width = 540;
      canvas.height = 960;
      return r;
    };

    document.body.innerHTML = '<canvas id="three-a" width="1080" height="1920"></canvas>';
    const first = kept('three-a', make);
    document.body.innerHTML = '<canvas id="three-a" width="1080" height="1920"></canvas>';
    const second = kept('three-a', make);

    expect(second).toBe(first);
    expect(made).toHaveLength(1);
    delete (window as unknown as Record<string, unknown>)[GL_GLOBAL];
  });
});
