import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, setKeyframes, type OpResult } from '../timeline';
import { Ease } from '../design';
import { TrackKind } from '../components';
import { composeHtml } from './compose';
import { POSE_ATTR } from './raster-key';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 120, props: { text: 'Make it move.' } }, 'title'));

function withGlass(props: Record<string, unknown> = {}, from = 0): MotionDoc {
  const doc = must(addTrack(titled, TrackKind.Visual, 'glass-track'));
  const top = { ...doc, tracks: [doc.tracks.find((t) => t.id === 'glass-track')!, ...doc.tracks.filter((t) => t.id !== 'glass-track')] };
  return must(addClip(top, { component: 'LiquidGlass', from, durationInFrames: 90, trackId: 'glass-track', props }, 'drop'));
}

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

const attrSets = (html: string, target: string) => [...html.matchAll(new RegExp(`tl\\.set\\("${target}",\\{"attr":(\\{[^}]*\\})\\},([\\d.]+)\\)`, 'g'))].map((m) => ({ attr: JSON.parse(m[1]) as Record<string, number>, at: Number(m[2]) }));

describe('liquid glass', () => {
  it('marks the moving glass body as one rigid pose, so the export rasters it once and moves it on the GPU', () => {
    expect(compose(withGlass())).toContain(`<g id="lgc-drop" ${POSE_ATTR}=""`);
  });

  it('bends what lies below it through one SVG lens filter, never backdrop-filter or CSS animations', () => {
    const html = compose(withGlass());
    const lens = html.indexOf('id="lg-drop"');

    expect(lens).toBeGreaterThan(-1);
    expect(html.indexOf('data-clip="title"')).toBeGreaterThan(lens);
    expect(html).toContain('filter:url(#lgf-drop)');
    expect(html).toContain('<feDisplacementMap');
    expect(html).toContain('color-interpolation-filters="sRGB"');
    expect(html.slice(lens, html.indexOf('<!--/group:drop-->'))).not.toMatch(/backdrop-filter|mask-composite|@keyframes|transition:|animation:/);
  });

  it('draws the lit rim as a vertical gradient stroke, bright at top and bottom', () => {
    const html = compose(withGlass({ rim: 2 }));
    const gradient = /<linearGradient id="lgr-drop"[^>]*>(.*?)<\/linearGradient>/.exec(html)?.[1] ?? '';

    expect(gradient.match(/stop-opacity="([\d.]+)"/g)?.map((s) => Number(/"([\d.]+)"/.exec(s)![1]))).toEqual([0.45, 0.15, 0, 0, 0.15, 0.45]);
    expect(html).toMatch(/stroke="url\(#lgr-drop\)"[^>]*stroke-width="2"/);
  });

  it('moves the lens with its keyframes, one frame at a time, the same on every compose', () => {
    const doc = must(setKeyframes(withGlass(), 'drop', 'centerX', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 60, value: 0.8, ease: Ease.Linear }]));
    const moves = attrSets(compose(doc), '#lgm-drop');

    expect(moves.length).toBeGreaterThan(50);
    expect(moves[moves.length - 1].attr.x).toBeGreaterThan(moves[0].attr.x);
    expect(compose(doc)).toBe(compose(doc));
  });

  it('wobbles its outline only when asked to', () => {
    const still = attrSets(compose(withGlass({ wobble: 0 })), '#lgm-drop');
    const wobbling = attrSets(compose(withGlass({ wobble: 0.05 })), '#lgm-drop');

    expect(still).toEqual([]);
    expect(wobbling.some((s) => s.attr.width !== undefined && s.attr.height !== undefined)).toBe(true);
  });

  it('leaves what is below untouched before the drop starts and after it ends', () => {
    const html = compose(withGlass({}, 30));

    expect(html).toMatch(/id="lg-drop"[^>]*style="[^"]*filter:none/);
    expect(html).toMatch(/tl\.set\("#lg-drop",\{"filter":"url\(#lgf-drop\)"\},0\.9833\)/);
    expect(html).toMatch(/tl\.set\("#lg-drop",\{"filter":"none"\},3\.9833\)/);
  });
});
