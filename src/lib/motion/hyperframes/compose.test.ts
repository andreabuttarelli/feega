import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { TransitionKind } from '../design';
import { Background, MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import gsap from 'gsap';
import { addClip, setKeyframes, setTransform, setTransition, Side, type OpResult } from '../timeline';
import { LIBRARY_IDS } from '../components';
import { Ease } from '../design';
import { findClip } from '../doc';
import { easeName, sampleTrack } from '../keyframes';
import { keyframeTweens } from './animate';
import { CAPTURE_REPLY, CAPTURE_REQUEST, composeHtml } from './compose';
import { writeComponent } from '../custom/ops';
import { PropFormat } from '../custom/component';
import { setExpression } from '../expression/ops';
import { bakeExpressions, expressionValue } from '../expression/bake';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 450 }, 'bg')), { component: 'Title', from: 15, durationInFrames: 60, props: { text: 'One\nTwo' } }, 'title'));

function compose(d: MotionDoc, assets: Record<string, string> = {}): string {
  return composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets });
}

describe('MotionDoc to HyperFrames composition', () => {
  it('the root carries the canvas size and duration in seconds', () => {
    expect(compose(doc)).toContain('data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="15" data-fps="30"');
  });

  it('each clip is a timed element at its own start and length, in seconds', () => {
    const html = compose(doc);

    expect(html).toContain('id="c-title" class="clip layer" data-clip="title" data-start="0.5" data-duration="2"');
    expect(html).toContain('id="c-bg" class="clip layer" data-clip="bg" data-start="0" data-duration="15"');
  });

  it('a clip added later on the same track stacks above', () => {
    const html = compose(doc);

    expect(html.indexOf('c-bg')).toBeLessThan(html.indexOf('c-title'));
  });

  it('registers one paused timeline under the composition id', () => {
    expect(compose(doc)).toContain('window.__timelines["main"]=tl');
  });

  it('a title reveals each line', () => {
    const html = compose(doc);

    expect(html).toContain('tl.fromTo("#li-title-0"');
    expect(html).toContain('tl.fromTo("#li-title-1"');
  });

  it('a transition becomes a tween on the clip at its edge', () => {
    const faded = must(setTransition(doc, 'title', Side.Out, { kind: TransitionKind.Fade, durationInFrames: 15 }));

    expect(compose(faded)).toContain('tl.fromTo("#fx-title",{"opacity":1},{"opacity":0,"duration":0.5,"ease":"power2.in","immediateRender":false},2)');
  });

  it('escapes text so props cannot inject markup', () => {
    const hostile = must(addClip(doc, { component: 'Text', from: 0, props: { text: '<script>alert(1)</script>' } }, 'x'));

    expect(compose(hostile)).not.toContain('<script>alert(1)</script>');
  });

  it('loads three.js only when a 3D clip exists', () => {
    expect(compose(doc)).not.toContain('importmap');

    const withModel = must(addClip(doc, { component: 'Model3D', from: 0, props: { assetId: 'glb' } }, 'm'));
    const html = compose(withModel, { glb: '/assets/glb' });

    expect(html).toContain('importmap');
    expect(html).toContain('<canvas id="three-m"');
    expect(html).toContain('"url":"/assets/glb"');
  });

  it('times media on the media element, never on its wrapper too', () => {
    const withVideo = must(addClip(doc, { component: 'Video', from: 30, props: { assetId: 'v' } }, 'vid'));
    const html = compose(withVideo, { v: '/assets/v' });

    expect(html).toContain('<div class="layer" data-clip="vid"');
    expect(html).toMatch(/<video id="c-vid" src="\/assets\/v" crossorigin="anonymous" preload="auto" muted playsinline data-start="1"/);
  });

  it('media is fetched with CORS so a captured frame or an export never taints the canvas', () => {
    const withAudio = must(addClip(must(addClip(doc, { component: 'Video', from: 0, props: { assetId: 'v' } }, 'vid')), { component: 'Audio', from: 0, props: { assetId: 'a' } }, 'mus'));
    const html = compose(withAudio, { v: '/v.mp4', a: '/a.mp3' });

    expect(html).toContain('<video id="c-vid" src="/v.mp4" crossorigin="anonymous"');
    expect(html).toContain('<audio id="c-mus" src="/a.mp3" crossorigin="anonymous"');
  });

  it('is deterministic', () => {
    expect(compose(structuredClone(doc))).toBe(compose(doc));
  });

  it('every component composes with its defaults', () => {
    for (const component of LIBRARY_IDS) {
      const one = must(addClip(newMotionDoc(MotionFormat.Square), { component, from: 0 }, 'k'));
      expect(compose(one)).toContain('data-clip="k"');
    }
  });

  it('a long title in a vertical frame asks for its size, to be fitted by measurement, inside the safe area', () => {
    const vertical = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Title', from: 0, props: { text: 'Your whole marketing,\non one canvas', size: 0.15, width: 1, height: 0.15 } }, 't'));
    const html = compose(vertical);
    expect(html).toContain(`data-fit="${0.15 * 1080}"`);
    expect(html).toContain('left:54px');
  });

  it('every animated layer is composited from the first frame, so seek history cannot change the pixels', () => {
    const html = compose(doc);

    expect(html).toContain('.fx{position:absolute;inset:0;will-change:transform,opacity}');
    expect(html).toContain('.li{display:block;will-change:transform}');
  });

  it('a staggered title line is held hidden from the clip start until its own reveal begins', () => {
    const html = compose(doc);

    expect(html).toContain('tl.set("#li-title-1",{"yPercent":105},0.5);');
    expect(html).not.toContain('tl.set("#li-title-0"');
  });

  it('answers a capture request with a JPEG of the root, so the agent can see frames', () => {
    const html = compose(doc);

    expect(html).toContain(`"${CAPTURE_REQUEST}"`);
    expect(html).toContain(`"${CAPTURE_REPLY}"`);
    expect(html).toContain('html-to-image@');
    expect(html).toMatch(/<link rel="stylesheet" crossorigin="anonymous" href="https:\/\/fonts\.googleapis\.com/);
  });

  it('hands an export a full-size bitmap, only once every video has finished seeking', () => {
    const html = compose(doc);

    expect(html).toContain('createImageBitmap');
    expect(html).toContain('seeked');
    expect(html).toContain('getFontEmbedCSS');
  });
});

describe('background of the frame', () => {
  it('paints the brand background by default', () => {
    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} })).toContain(`#root{background:${FEEGA_TOKENS.colors['brand.background']}}`);
  });

  it('a transparent video paints nothing behind its clips, so alpha formats keep the alpha', () => {
    const html = composeHtml({ doc: { ...doc, background: Background.Transparent }, tokens: FEEGA_TOKENS, assets: {} });

    expect(html).toContain('#root{background:transparent}');
    expect(html).not.toContain('data-clip="bg"');
    expect(html).toContain('data-clip="title"');
  });
});

describe('keyframes and 3D transforms', () => {
  const card = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 30, durationInFrames: 120, props: { shape: 'rect', x: 0.25, y: 0.5, width: 0.2, height: 0.4 } }, 'card'));
  const spun = must(
    setKeyframes(
      must(setTransform(must(setTransition(card, 'card', Side.In, { kind: TransitionKind.Fade, durationInFrames: 10 })), 'card', { perspective: 900, anchorX: 0, rotateX: 15 })),
      'card',
      'rotateY',
      [
        { frame: 0, value: 0, ease: Ease.Linear },
        { frame: 60, value: 180, ease: [0.2, 0.8, 0.2, 1] },
        { frame: 100, value: 360, ease: Ease.Overshoot }
      ]
    )
  );
  const moved = must(setKeyframes(spun, 'card', 'x', [{ frame: 0, value: 0, ease: Ease.Standard }, { frame: 90, value: 0.5, ease: Ease.Linear }]));
  const coloured = must(setKeyframes(moved, 'card', 'fill', [{ frame: 0, value: '#ff0000', ease: Ease.Linear }, { frame: 30, value: 'brand.accent', ease: Ease.Linear }]));

  it('a clip without transform or keyframes keeps its plain markup', () => {
    expect(compose(card)).not.toContain('id="kf-card"');
  });

  it('a transformed clip nests perspective, transform and scale wrappers inside its transition wrapper', () => {
    const html = compose(spun);

    expect(html).toMatch(/<div class="fx" id="fx-card"><div class="kp" id="kp-card" style="[^"]*perspective:900px[^"]*"><div class="kf" id="kf-card"[^>]*><div class="ks" id="ks-card"/);
    expect(html).toContain('.kf,.ks{position:absolute;inset:0;transform-style:preserve-3d;backface-visibility:visible;will-change:transform,opacity,filter}');
  });

  it('the anchor is a point of the clip box, not of the frame', () => {
    expect(compose(spun)).toMatch(/id="kf-card" style="transform-origin:288px 540px"/);
  });

  it('base transform values are set before the timeline exists', () => {
    expect(compose(spun)).toContain('gsap.set("#kf-card",{"rotationX":15,"rotationY":0});');
  });

  it('each keyframe segment is one tween on the transform wrapper, with its own ease', () => {
    const html = compose(spun);

    expect(html).toContain('tl.fromTo("#kf-card",{"rotationY":0},{"rotationY":180,"duration":2,"ease":"none","immediateRender":false},1);');
    expect(html).toContain(`tl.fromTo("#kf-card",{"rotationY":180},{"rotationY":360,"duration":1.3333333333333333,"ease":${JSON.stringify(easeName([0.2, 0.8, 0.2, 1]))},"immediateRender":false},3);`);
    expect(html).toContain(`gsap.registerEase(${JSON.stringify(easeName([0.2, 0.8, 0.2, 1]))}`);
  });

  it('a lane holds its first value from the clip start', () => {
    expect(compose(spun)).toContain('tl.set("#kf-card",{"rotationY":0},1);');
  });

  it('an offset is a fraction of the frame, tweened in pixels', () => {
    expect(compose(moved)).toContain('tl.fromTo("#kf-card",{"x":0},{"x":960,"duration":3,"ease":"power3.out","immediateRender":false},1);');
  });

  it('a colour keyframe tweens a CSS variable the template reads, brand colours resolved', () => {
    const html = compose(coloured);

    expect(html).toContain('background:var(--kc-fill)');
    expect(html).toContain(`tl.fromTo("#ks-card",{"--kc-fill":"#ff0000"},{"--kc-fill":"${FEEGA_TOKENS.colors['brand.accent']}"`);
  });

  it('no element and property is tweened by two sources', () => {
    const html = compose(must(setKeyframes(coloured, 'card', 'opacity', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }])));
    const owners = new Map<string, string>();
    for (const [, target, vars] of html.matchAll(/tl\.fromTo\("([^"]+)",(\{[^}]*\})/g)) {
      for (const prop of Object.keys(JSON.parse(vars))) {
        const lane = `${target} ${prop}`;
        const source = target.split('-')[0];
        expect(owners.get(lane) ?? source).toBe(source);
        owners.set(lane, source);
      }
    }
    expect(owners.get('#fx-card opacity')).toBeDefined();
    expect(owners.get('#kf-card opacity')).toBeDefined();
  });

  it('the generated tweens land on the sampled value at every frame, whatever order the frames are sought in', () => {
    const clip = findClip(moved, 'card')!.clip;
    const tweens = keyframeTweens(clip, moved, (c) => c).filter((t) => t.target === '#kf-card');
    const bezier = (p: number) => sampleTrack([{ frame: 0, value: 0, ease: [0.2, 0.8, 0.2, 1] }, { frame: 1, value: 1, ease: 'linear' }], p);
    const run = () => {
      const target = { rotationY: 0, x: 0 };
      const tl = gsap.timeline({ paused: true });
      for (const t of tweens) {
        tl.fromTo(target, t.from, { ...t.to, duration: t.duration, ease: t.ease.startsWith('kf-bz') ? bezier : t.ease, immediateRender: false }, t.at);
      }
      return { target, tl };
    };
    const expected = (frame: number) => ({
      rotationY: sampleTrack(clip.keyframes.rotateY, frame - clip.from),
      x: sampleTrack(clip.keyframes.x, frame - clip.from) * moved.width
    });

    const ordered = run();
    const shuffled = run();
    const frames = Array.from({ length: 121 }, (_, i) => 30 + i);
    const random = [...frames].sort((a, b) => Math.sin(a * 12.9898) - Math.sin(b * 12.9898));
    const seen = new Map<number, { rotationY: number; x: number }>();

    for (const f of frames) {
      ordered.tl.seek(f / 30);
      seen.set(f, { ...ordered.target });
    }
    for (const f of random) {
      shuffled.tl.seek(f / 30);
      expect(shuffled.target.rotationY).toBeCloseTo(seen.get(f)!.rotationY, 6);
      expect(shuffled.target.x).toBeCloseTo(seen.get(f)!.x, 6);
      expect(shuffled.target.rotationY).toBeCloseTo(expected(f).rotationY, 3);
      expect(shuffled.target.x).toBeCloseTo(expected(f).x, 3);
    }
  });

  it('3D model keyframes drive the three.js object and camera with the same sampler', () => {
    const model = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Model3D', from: 0, props: { assetId: 'glb' } }, 'm'));
    const orbit = must(setKeyframes(model, 'm', 'orbit', [{ frame: 0, value: -30, ease: Ease.Linear }, { frame: 60, value: 30, ease: Ease.Standard }]));
    const html = compose(orbit, { glb: '/assets/glb' });

    expect(html).toContain('"keys":{"orbit":[{"frame":0,"value":-30,"ease":"linear"},{"frame":60,"value":30,"ease":"standard"}]}');
    expect(html).toContain('function sampleTrack(');
  });
});

describe('custom components in the composition', () => {
  const graph = {
    source: { html: '<div class="node"></div>', css: '.node{background:#111}', js: 'tl.from(root.querySelector(".node"),{scale:0,duration:0.4});' },
    propsSchema: { type: 'object' as const, properties: { accent: { type: 'string' as const, format: PropFormat.Color, default: 'brand.accent' }, picture: { type: 'string' as const, format: PropFormat.Asset, default: '' } } }
  };
  const custom = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'NodeGraph', graph)), { component: 'Custom', from: 30, durationInFrames: 60, props: { name: 'NodeGraph', picture: 'img1' } }, 'g1'));
  const html = compose(custom, { img1: 'https://store.supabase.co/storage/v1/object/sign/a.png?token=t' });

  it('renders the component markup under a root scoped to the clip', () => {
    expect(html).toContain('<div class="cc" id="cc-g1" data-component="NodeGraph"><style>@scope (#cc-g1) {.node{background:#111}}</style><div class="node"></div></div>');
  });

  it('gives the component root the full frame, so code can measure it', () => {
    expect(html).toContain('.cc{position:absolute;inset:0;overflow:hidden}');
  });

  it('defines the component code once and boots it at the clip start with resolved props', () => {
    expect(html).toContain('["NodeGraph"]=function(ctx,window,self,');
    expect(html).toContain('"start":1,"length":2');
    expect(html).toContain('"accent":"#0099ff","picture":"https://store.supabase.co/storage/v1/object/sign/a.png?token=t"');
  });

  it('declares a policy that allows media only from the asset origin and no other network', () => {
    const policy = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '').replace(/&#39;/g, "'");
    const connect = policy.split('; ').find((d) => d.startsWith('connect-src'));

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("img-src 'self' data: blob: https://store.supabase.co");
    expect(policy).not.toContain('unsafe-eval');
    expect(connect).toBe('connect-src data: blob: https://fonts.googleapis.com https://fonts.gstatic.com https://store.supabase.co');
  });

  it('lets a picture or clip load from the page origin, where the server renderer moves remote media', () => {
    const policy = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '').replace(/&#39;/g, "'");

    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("media-src 'self' data: blob:");
  });
  it('an expression renders as the keyframes it bakes to, and lands on its value whatever order the frames are sought in', () => {
    const shaky = must(setExpression(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 30, durationInFrames: 90 }, 'card')), 'card', 'x', 'wiggle(3, 0.05) + time * 0.1'));
    const baked = bakeExpressions(shaky);

    expect(compose(shaky)).toBe(compose(baked));
    expect(compose(shaky)).toContain('#kf-card');

    const tweens = keyframeTweens(findClip(baked, 'card')!.clip, baked, (c) => c).filter((t) => t.target === '#kf-card');
    const target = { x: 0 };
    const tl = gsap.timeline({ paused: true });
    for (const t of tweens) {
      tl.fromTo(target, t.from, { ...t.to, duration: t.duration, ease: t.ease, immediateRender: false }, t.at);
    }
    const frames = Array.from({ length: 90 }, (_, i) => 30 + i).sort((a, b) => Math.sin(a * 12.9898) - Math.sin(b * 12.9898));
    for (const f of frames) {
      tl.seek(f / 30);
      expect(target.x / baked.width).toBeCloseTo(expressionValue(shaky, 'card', 'x', f), 3);
    }
  });
});
