// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { precompose } from '../precomp';
import { addClip, removeClips, type OpResult } from '../timeline';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SCREEN_FRAME = { width: 390, height: 848 };

const withUi = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Daily Loop' } }, 'title'));
  doc = must(precompose({ ...doc, durationInFrames: 90 }, ['title'], { comp: 'ui', clip: 'pc' }, 'App UI'));
  doc = must(removeClips(doc, ['pc']));
  return { ...doc, comps: { ...doc.comps, ui: { ...doc.comps.ui, frame: SCREEN_FRAME } } };
})();

const device = (doc: MotionDoc, id: string, props: Record<string, unknown>) => must(addClip(doc, { component: 'Device3D', from: 0, durationInFrames: 90, props: { screenComp: 'ui', ...props } }, id));

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

function face(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  return start < 0 ? '' : html.slice(start, html.indexOf('<!--/screen-->', start));
}

const px = (style: string, prop: string) => Number(new RegExp(`${prop}:(\\d+(\\.\\d+)?)px`).exec(style)?.[1] ?? 0);

describe('a composition on a device screen', () => {
  it('a phone draws the composition live, as DOM, on its screen', () => {
    const html = compose(device(withUi, 'ph', { device: 'phone-pro' }));

    expect(face(html, 'dsf-ph-0')).toContain('data-clip="ph-scr0__0__title"');
  });

  it('lays the composition out on its own frame', () => {
    const html = compose(device(withUi, 'ph', { device: 'phone-pro' }));

    expect(face(html, 'dsf-ph-0')).toMatch(/class="dsc" style="[^"]*width:390px;height:848px/);
  });

  it('rasterises the screen at least twice its size in the frame', () => {
    const doc = device(withUi, 'ph', { device: 'phone-pro', height: 1, y: 0.5 });
    const box = face(compose(doc), 'dsf-ph-0').slice(0, 400);

    expect(px(box, 'height')).toBeGreaterThanOrEqual(2 * doc.height);
  });

  it('a foldable spreads one composition over its two halves', () => {
    const html = compose(device(withUi, 'fd', { device: 'foldable' }));

    expect(face(html, 'dsf-fd-0')).toContain('fd-scr0__0__title');
    expect(face(html, 'dsf-fd-1')).toContain('fd-scr1__0__title');
  });

  it('the runtime knows which faces to place', () => {
    expect(compose(device(withUi, 'ph', { device: 'phone-pro' }))).toMatch(/"faces":\[\{"w":\d+(\.\d+)?,"h":\d+/);
  });

  it('a device without a composition draws no screen faces', () => {
    const html = compose(must(addClip(withUi, { component: 'Device3D', from: 0, durationInFrames: 90 }, 'bare')));

    expect(html).not.toContain('dsf-bare-0');
  });

  it('refuses a composition the video does not have', () => {
    const result = addClip(withUi, { component: 'Device3D', from: 0, durationInFrames: 90, props: { screenComp: 'nope' } }, 'x');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('ui');
  });
});

describe('a device screen before its first placement', () => {
  it('starts transparent, so its live clips never show unprojected', () => {
    const html = compose(device(withUi, 'ph', { device: 'phone-pro' }));

    expect(face(html, 'dsf-ph-0').slice(0, 400)).toMatch(/^id="dsf-ph-0" class="dsf" style="[^"]*opacity:0/);
  });
});
