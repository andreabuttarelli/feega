import { describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { FEEGA_TOKENS } from '../brand';
import { TrackKind } from '../components';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { sampleTrack } from '../keyframes';
import { MaskKind, Matte, type MaskInput } from '../mask';
import { addClip, addTrack, setKeyframes, setMask, setTrackMatte, type OpResult } from '../timeline';
import { keyframeTweens } from './animate';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 30, durationInFrames: 120, props: { assetId: 'pic' } }, 'img'));
const ASSETS = { pic: '/assets/pic', lum: '/assets/lum' };

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: ASSETS });
const masked = (mask: MaskInput) => compose(must(setMask(base, 'img', mask)));

describe('mask markup', () => {
  it('a clip without a mask has no mask wrapper', () => {
    expect(compose(base)).not.toContain('id="km-img"');
  });

  it('a masked clip is wrapped in one element that points at its SVG mask', () => {
    const html = masked({ kind: MaskKind.Ellipse });

    expect(html).toContain('<div class="km" id="km-img" style="mask:url(#mk-img);-webkit-mask:url(#mk-img)">');
    expect(html).toMatch(/<mask id="mk-img" maskUnits="userSpaceOnUse" x="-1920" y="-1080" width="5760" height="3240">/);
  });

  it('position, rotation and size are one transform per prop, in frame pixels, around a 100-unit shape', () => {
    const html = masked({ kind: MaskKind.Ellipse, x: 0.25, y: 0.75, width: 0.5, height: 0.2, rotation: 30 });

    expect(html).toContain('<g id="mx-img" transform="translate(480 0)"><g id="my-img" transform="translate(0 810)"><g id="mr-img" transform="rotate(30)"><g id="mw-img" transform="scale(9.6 1)"><g id="mh-img" transform="scale(1 2.16)">');
  });

  it.each([
    [MaskKind.Rect, '<rect x="-50" y="-50" width="100" height="100" fill="#fff"/>'],
    [MaskKind.Ellipse, '<ellipse rx="50" ry="50" fill="#fff"/>'],
    [MaskKind.Linear, '<rect x="-50" y="-50" width="100" height="100" fill="url(#mg-img)"/>'],
    [MaskKind.Radial, '<ellipse rx="50" ry="50" fill="url(#mg-img)"/>']
  ])('a %s mask draws its shape', (kind, shape) => {
    expect(masked({ kind })).toContain(shape);
  });

  it('a polygon maps its box points around the centre', () => {
    expect(masked({ kind: MaskKind.Polygon, points: [[0, 0], [1, 0], [0.5, 1]] })).toContain('<polygon points="-50,-50 50,-50 0,50" fill="#fff"/>');
  });

  it('a text mask stretches the escaped text over its box', () => {
    const html = masked({ kind: MaskKind.Text, text: 'A<B\nC' });

    expect(html).toMatch(/<text [^>]*textLength="100" lengthAdjust="spacingAndGlyphs"[^>]*>A&lt;B C<\/text>/);
  });

  it('a picture mask uses the asset alpha, a luminance mask its brightness', () => {
    const alpha = masked({ kind: MaskKind.Image, assetId: 'pic' });
    const luma = masked({ kind: MaskKind.Luma, assetId: 'lum' });

    expect(alpha).toContain('<image href="/assets/pic" x="-50" y="-50" width="100" height="100" preserveAspectRatio="none" filter="url(#ma-img)"/>');
    expect(alpha).toContain('values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"');
    expect(luma).toContain('values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.2125 0.7154 0.0721 0 0"');
  });

  it('gradients fade from opaque to clear along the box', () => {
    expect(masked({ kind: MaskKind.Linear })).toContain('<linearGradient id="mg-img" gradientUnits="userSpaceOnUse" x1="-50" y1="0" x2="50" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>');
    expect(masked({ kind: MaskKind.Radial })).toContain('<radialGradient id="mg-img" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="50">');
  });

  it('invert paints the frame and cuts the shape out of it', () => {
    const html = masked({ kind: MaskKind.Ellipse, invert: true });

    expect(html).toContain('<rect x="-1920" y="-1080" width="5760" height="3240" fill="#fff"/>');
    expect(html).toContain('<ellipse rx="50" ry="50" fill="#000"/>');
  });

  it('feather blurs, expansion grows or shrinks, opacity fades the whole mask', () => {
    const grown = masked({ kind: MaskKind.Rect, feather: 12, expansion: 8, opacity: 0.5 });
    const shrunk = masked({ kind: MaskKind.Rect, expansion: -6 });

    expect(grown).toContain('<feMorphology id="me-img" operator="dilate" radius="8"/><feMorphology id="mn-img" operator="erode" radius="0"/><feGaussianBlur id="mb-img" stdDeviation="12"/>');
    expect(grown).toContain('<g id="mo-img" opacity="0.5">');
    expect(shrunk).toContain('<feMorphology id="me-img" operator="dilate" radius="0"/><feMorphology id="mn-img" operator="erode" radius="6"/>');
  });

  it('the mask lives inside the clip transform, so it moves with the layer', () => {
    const doc = must(setKeyframes(must(setMask(base, 'img', { kind: MaskKind.Ellipse })), 'img', 'rotateZ', [{ frame: 0, value: 0, ease: Ease.Linear }]));

    expect(compose(doc)).toMatch(/<div class="ks" id="ks-img"[^>]*><svg class="kd"[^>]*>.*<\/svg><div class="km" id="km-img"/);
  });
});

describe('animated masks', () => {
  const ellipse = must(setMask(base, 'img', { kind: MaskKind.Ellipse, width: 0.1 }));
  const grown = must(setKeyframes(ellipse, 'img', 'maskWidth', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 1.2, ease: Ease.Standard }]));
  const moved = must(setKeyframes(grown, 'img', 'maskX', [{ frame: 0, value: 0.2, ease: Ease.Standard }, { frame: 90, value: 0.8, ease: [0.2, 0.8, 0.2, 1] }]));
  const all = must(setKeyframes(moved, 'img', 'maskExpansion', [{ frame: 0, value: -10, ease: Ease.Linear }, { frame: 30, value: 0, ease: Ease.Linear }, { frame: 60, value: 20, ease: Ease.Linear }]));

  it('starts from its first keyframe, not from its base value', () => {
    expect(compose(grown)).toContain('<g id="mw-img" transform="scale(0 1)">');
  });

  it('each segment tweens the attribute that prop owns', () => {
    expect(compose(grown)).toContain('tl.fromTo("#mw-img",{"attr":{"transform":"scale(0 1)"}},{"attr":{"transform":"scale(23.04 1)"},"duration":2,"ease":"none","immediateRender":false},1);');
  });

  it('expansion drives dilate above zero and erode below it', () => {
    const html = compose(all);

    expect(html).toContain('tl.fromTo("#mn-img",{"attr":{"radius":10}},{"attr":{"radius":0}');
    expect(html).toContain('tl.fromTo("#me-img",{"attr":{"radius":0}},{"attr":{"radius":20}');
  });

  it('no mask element and attribute is tweened by two props', () => {
    const tweens = keyframeTweens(findClip(all, 'img')!.clip, all, (c) => c);
    const owners = new Map<string, string>();
    for (const t of tweens) {
      for (const attr of Object.keys((t.to as { attr?: object }).attr ?? {})) {
        const lane = `${t.target} ${attr}`;
        expect([undefined, t.target]).toContain(owners.get(lane));
        owners.set(lane, t.target);
      }
    }
    expect([...owners.keys()].sort()).toEqual(['#me-img radius', '#mn-img radius', '#mw-img transform', '#mx-img transform']);
  });

  it('lands on the sampled value at every frame, whatever order the frames are sought in', () => {
    vi.stubGlobal('window', globalThis);
    gsap.ticker.wake();
    gsap.ticker.sleep();
    vi.unstubAllGlobals();
    const clip = findClip(moved, 'img')!.clip;
    const tweens = keyframeTweens(clip, moved, (c) => c).filter((t) => t.target.startsWith('#m'));
    const bezier = (p: number) => sampleTrack([{ frame: 0, value: 0, ease: [0.2, 0.8, 0.2, 1] }, { frame: 1, value: 1, ease: 'linear' }], p);
    const element = () => {
      const attrs = new Map<string, string>();
      return { getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: unknown) => attrs.set(k, String(v)), attrs };
    };
    const run = () => {
      const els: Record<string, ReturnType<typeof element>> = { '#mw-img': element(), '#mx-img': element() };
      const tl = gsap.timeline({ paused: true });
      for (const t of tweens) {
        tl.fromTo(els[t.target], t.from, { ...t.to, duration: t.duration, ease: t.ease.startsWith('kf-bz') ? bezier : t.ease, immediateRender: false }, t.at);
      }
      return { els, tl };
    };
    const number = (s: string | undefined) => Number(/-?[\d.]+/.exec(s ?? '')?.[0]);
    const read = (r: ReturnType<typeof run>) => ({ w: number(r.els['#mw-img'].attrs.get('transform')), x: number(r.els['#mx-img'].attrs.get('transform')) });

    const ordered = run();
    const shuffled = run();
    const frames = Array.from({ length: 91 }, (_, i) => 30 + i);
    const random = [...frames].sort((a, b) => Math.sin(a * 78.233) - Math.sin(b * 78.233));
    const seen = new Map<number, { w: number; x: number }>();

    for (const f of frames) {
      ordered.tl.seek(f / 30);
      seen.set(f, read(ordered));
    }
    for (const f of random) {
      shuffled.tl.seek(f / 30);
      const got = read(shuffled);
      expect(got.w).toBeCloseTo(seen.get(f)!.w, 4);
      expect(got.x).toBeCloseTo(seen.get(f)!.x, 4);
      expect(got.w).toBeCloseTo((sampleTrack(clip.keyframes.maskWidth, f - 30) * 1920) / 100, 2);
      expect(got.x).toBeCloseTo(sampleTrack(clip.keyframes.maskX, f - 30) * 1920, 1);
    }
  });

  it('is deterministic', () => {
    expect(compose(structuredClone(all))).toBe(compose(all));
  });
});

describe('frames the agent sees', () => {
  it('a capture freezes each mask into a self-contained image first, since a cloned url(#id) points nowhere', () => {
    const html = masked({ kind: MaskKind.Ellipse });
    const capture = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('feega:capture'))!;

    expect(capture).toContain('.km,.kt');
    expect(capture).toContain('luminanceToAlpha');
    expect(capture.indexOf('freeze().then')).toBeLessThan(capture.indexOf('output[m.format]'));
    expect(capture.indexOf('freeze().then')).toBeGreaterThan(-1);
  });
});

describe('track matte composition', () => {
  const stacked = must(
    addClip(must(addTrack(base, TrackKind.Visual, 'top')), { component: 'Title', from: 30, durationInFrames: 120, trackId: 'top', props: { text: 'GO', width: 0.6, height: 0.4 } }, 'title')
  );
  const matted = must(setTrackMatte(stacked, 'img', Matte.Alpha));

  it('the matte source is hidden, still timed', () => {
    expect(compose(matted)).toMatch(/<div class="matte-src" style="display:none"><div id="c-title" class="clip layer"/);
    expect(compose(stacked)).not.toContain('matte-src');
  });

  it('the matted clip is cut by the source shape, in frame space', () => {
    const html = compose(matted);

    expect(html).toMatch(/<div class="fx" id="fx-img"><svg class="kd"[^>]*><defs>.*<mask id="tk-img"/);
    expect(html).toContain('<div class="kt" id="kt-img" style="mask:url(#tk-img);-webkit-mask:url(#tk-img)">');
    expect(html).toMatch(/<text [^>]*>GO<\/text>/);
  });

  it('a matte and a mask combine on the same clip', () => {
    const html = compose(must(setMask(matted, 'img', { kind: MaskKind.Ellipse })));

    expect(html).toContain('id="kt-img"');
    expect(html).toContain('id="km-img"');
  });
});
