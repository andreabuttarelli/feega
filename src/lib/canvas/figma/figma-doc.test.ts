import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotionDoc, type MotionClip } from '$lib/motion/doc';
import { figmaFrameDoc } from './figma-doc';

const clip = readFileSync(new URL('../../../../tests/fixtures/figma/clip-1.html', import.meta.url), 'utf8');

let n = 0;
const newId = () => `id${++n}`;

const clipsOf = (doc: { tracks: { clips: unknown[] }[]; comps: Record<string, { tracks: { clips: unknown[] }[] }> }): MotionClip[] =>
  [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

describe('a Figma paste as a frame', () => {
  it('builds a valid frame doc the size of the copied frame', () => {
    const made = figmaFrameDoc(clip, newId);
    expect(made).not.toBeNull();
    expect(parseMotionDoc(made!.doc).ok).toBe(true);
    expect(made!.box).toEqual({ width: 1920, height: 1080 });
    expect(made!.name).toBe('Cover');
  });

  it('lands the text as an editable Text clip in Archivo bold', () => {
    const doc = figmaFrameDoc(clip, newId)!.doc;
    const text = clipsOf(doc).find((c) => c.component === 'Text');
    expect(text?.props).toMatchObject({ text: 'dal \nnulla', font: 'Archivo', weight: 700, color: '#ffffff', letterSpacing: '-7%', lineHeight: '83%' });
    expect(doc.fonts.map((f) => f.family)).toContain('Archivo');
  });

  it('lands the ghost as three even-odd vector shapes grouped, over a black background', () => {
    const clips = clipsOf(figmaFrameDoc(clip, newId)!.doc);
    const shapes = clips.filter((c) => c.component === 'Shape');
    expect(shapes.filter((s) => s.props.fill === '#fd5e29' && s.props.fillRule === 'evenodd')).toHaveLength(3);
    expect(shapes.some((s) => s.props.fill === '#000000')).toBe(true);
    expect(clips.some((c) => c.component === 'Precomp')).toBe(true);
  });

  it('returns null for html without Figma data', () => {
    expect(figmaFrameDoc('<p>x</p>', newId)).toBeNull();
  });
});

