import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { TransitionKind } from '../design';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setTransition, Side } from '../timeline';
import { COMPONENT_IDS } from '../components';
import { composeHtml } from './compose';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
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
    expect(html).toMatch(/<video id="c-vid" src="\/assets\/v" muted playsinline data-start="1"/);
  });

  it('is deterministic', () => {
    expect(compose(structuredClone(doc))).toBe(compose(doc));
  });

  it('every component composes with its defaults', () => {
    for (const component of COMPONENT_IDS) {
      const one = must(addClip(newMotionDoc(MotionFormat.Square), { component, from: 0 }, 'k'));
      expect(compose(one)).toContain('data-clip="k"');
    }
  });

  it('a long title in a vertical frame shrinks to fit inside the safe area', () => {
    const vertical = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Title', from: 0, props: { text: 'Your whole marketing,\non one canvas', size: 0.15, width: 1, height: 0.15 } }, 't'));
    const html = compose(vertical);
    const size = Number(/font-size:([\d.]+)px;line-height:0.95/.exec(html)?.[1]);

    expect(size).toBeLessThan(0.15 * 1080);
    expect(html).toContain('left:54px');
  });

  it('a staggered title line is held hidden from the clip start until its own reveal begins', () => {
    const html = compose(doc);

    expect(html).toContain('tl.set("#li-title-1",{"yPercent":105},0.5);');
    expect(html).not.toContain('tl.set("#li-title-0"');
  });
});
