import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, setKeyframes, type OpResult } from '../timeline';
import { Ease } from '../design';
import { TrackKind } from '../components';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 120, props: { text: 'Make it move.' } }, 'title'));

function withBlob(props: Record<string, unknown> = {}): MotionDoc {
  const doc = must(addTrack(titled, TrackKind.Visual, 'blob-track'));
  const top = { ...doc, tracks: [doc.tracks.find((t) => t.id === 'blob-track')!, ...doc.tracks.filter((t) => t.id !== 'blob-track')] };
  return must(addClip(top, { component: 'LiquidBlob', from: 30, durationInFrames: 60, trackId: 'blob-track', props }, 'drop'));
}

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

function bakeOf(html: string): { id: string; start: number; length: number; rows: number[][] } {
  const raw = /const B=(\[.*?\]);\n/.exec(html)?.[1];
  return JSON.parse(raw ?? '[]')[0];
}

describe('liquid blob', () => {
  it('wraps what lies below in its scope and draws on one WebGL canvas above it', () => {
    const html = compose(withBlob());
    const scope = html.indexOf('id="lbw-drop"');

    expect(scope).toBeGreaterThan(-1);
    expect(html.indexOf('data-clip="title"')).toBeGreaterThan(scope);
    expect(html.indexOf('<canvas class="ef" id="lb-drop" width="1920" height="1080"')).toBeGreaterThan(html.indexOf('data-clip="title"'));
    expect(html).toContain("getContext('webgl'");
    expect(html).toContain('refract(');
  });

  it('bakes one pose per frame for its own time range only', () => {
    const bake = bakeOf(compose(withBlob()));

    expect(bake).toMatchObject({ id: 'drop', start: 1, length: 2 });
    expect(bake.rows).toHaveLength(61);
  });

  it('moves with its keyframes and composes the same on every call', () => {
    const doc = must(setKeyframes(withBlob(), 'drop', 'centerX', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 40, value: 0.8, ease: Ease.Linear }]));
    const rows = bakeOf(compose(doc)).rows;

    expect(rows[40][0]).toBeGreaterThan(rows[0][0]);
    expect(compose(doc)).toBe(compose(doc));
  });

  it('adds no WebGL runtime to a video without a blob', () => {
    expect(compose(titled)).not.toContain('feegaBlob');
  });
});
