// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { installEngine, type TestTimeline } from '../engine/testing';
import { FEEGA_TOKENS } from '../brand';
import { BlendMode } from '../blend';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { EffectKind } from '../effects/registry';
import { addEffect } from '../effects/ops';
import { addAdjustment, precompose } from '../precomp';
import { setBlendMode } from '../blend-ops';
import { addClip, setProps, type OpResult } from '../timeline';
import { audioPlan } from '../audio-plan';
import { seekPlan } from '../custom/determinism';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 120 }, 'bg'));
  doc = must(addClip(doc, { component: 'Title', from: 0, durationInFrames: 60 }, 'title'));
  doc = must(addClip(doc, { component: 'Caption', from: 30, durationInFrames: 60 }, 'cap'));
  return { ...doc, durationInFrames: 120 };
})();

const grouped = must(addEffect(must(precompose(base, ['title', 'cap'], { comp: 'intro', clip: 'pc' }, 'Intro')), 'pc', EffectKind.GaussianBlur, 'blur', { radius: 6 }));
const adjusted = must(addEffect(must(addAdjustment(base, { from: 30, durationInFrames: 30 }, { clip: 'adj', track: 'fx' })), 'adj', EffectKind.GaussianBlur, 'soft', { radius: 8 }));

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

function inside(html: string, group: string): string {
  const start = html.indexOf(`data-group="${group}"`);
  const end = html.indexOf(`<!--/group:${group}-->`);
  return start > 0 && end > start ? html.slice(start, end) : '';
}

describe('a precomp in the composed page', () => {
  it('draws its composition inside one group, and nothing else', () => {
    const group = inside(compose(grouped), 'pc');

    expect(group).toContain('data-clip="pc__0__title"');
    expect(group).toContain('data-clip="pc__0__cap"');
    expect(group).not.toContain('data-clip="bg"');
  });

  it('its effects filter the whole group', () => {
    const group = inside(compose(grouped), 'pc');

    expect(group.indexOf('id="ef-pc"')).toBeLessThan(group.indexOf('data-clip="pc__0__title"'));
  });

  it('its blend mode blends the group as one', () => {
    const html = compose(must(setBlendMode(grouped, 'pc', BlendMode.Screen)));

    expect(html.slice(html.indexOf('data-group="pc"') - 200, html.indexOf('data-group="pc"') + 300)).toContain('mix-blend-mode:screen');
  });

  it('a looping precomp draws each pass', () => {
    let doc = must(setProps(grouped, 'pc', { loop: true }));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, durationInFrames: 120 } : c)) })) };

    expect(inside(compose(doc), 'pc')).toContain('data-clip="pc__1__title"');
  });
});

describe('an adjustment layer in the composed page', () => {
  it('wraps every layer under it', () => {
    const group = inside(compose(adjusted), 'adj');

    expect(group).toContain('data-clip="bg"');
    expect(group).toContain('data-clip="title"');
  });

  it('a layer above it stays outside', () => {
    const doc = must(addClip(adjusted, { component: 'Kicker', from: 0, durationInFrames: 60, trackId: 'fx' }, 'top'));
    const above = { ...doc, tracks: [{ id: 'top-track', kind: doc.tracks[0].kind, name: '', clips: doc.tracks[0].clips.filter((c) => c.id === 'top') }, { ...doc.tracks[0], clips: doc.tracks[0].clips.filter((c) => c.id !== 'top') }, ...doc.tracks.slice(1)] };

    expect(inside(compose(above), 'adj')).not.toContain('data-clip="top"');
  });
});

function boot(doc: MotionDoc) {
  const html = compose(doc);
  const root = html.slice(html.indexOf('<div id="root"'), html.indexOf('<script>const tl'));
  const script = /<script(?: data-hot)?>([^<]*const tl=window\.__feegaMotion\.timeline[\s\S]*?)<\/script>/.exec(html)![1];
  document.body.innerHTML = root;
  installEngine();
  window.eval(script);
  return (window as unknown as { __timelines: Record<string, TestTimeline> }).__timelines.main;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__timelines;
});

describe('an adjustment layer at runtime', () => {
  const filter = () => (document.getElementById('ef-adj') as HTMLElement).style.filter;

  it('filters only while it is on screen', () => {
    const tl = boot(adjusted);
    const at = (t: number) => {
      tl.totalTime(t, true);
      return filter();
    };

    expect([at(0.5), at(1.5), at(2.5)]).toEqual(['none', 'blur(8px)', 'none']);
  });

  it('gives the same frame from any seek order (seek determinism)', () => {
    const tl = boot(adjusted);
    const seen = new Map<number, string>();

    for (const t of seekPlan(4, 30)) {
      tl.totalTime(t, true);
      expect(seen.get(t) ?? filter()).toBe(filter());
      seen.set(t, filter());
    }
  });
});

describe('sound inside a precomp', () => {
  it('a video in a composition is heard at the precomp time', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Video', from: 0, durationInFrames: 60, props: { assetId: 'v', volume: 1 } }, 'clip'));
    doc = must(precompose(doc, ['clip'], { comp: 'c', clip: 'p' }, 'C'));
    doc = must(setProps({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'p' ? { ...c, from: 30 } : c)) })) }, 'p', {}));

    expect(audioPlan(doc, { v: 'https://x/v.mp4' }).map((e) => e.at)).toEqual([1]);
  });
});
