import { describe, expect, it } from 'vitest';
import { FORMATS, MAX_FRAMES, MotionFormat, newMotionDoc, parseMotionDoc } from './doc';

function clip(component: string) {
  return {
    id: 'c1',
    from: 0,
    durationInFrames: 30,
    trimStart: 0,
    component,
    props: {},
    transitionIn: { kind: 'none', durationInFrames: 0 },
    transitionOut: { kind: 'none', durationInFrames: 0 }
  };
}

describe('MotionDoc', () => {
  it('a new doc has the size of its format, one visual and one audio track', () => {
    const doc = newMotionDoc(MotionFormat.Vertical);

    expect(doc.width).toBe(FORMATS[MotionFormat.Vertical].width);
    expect(doc.height).toBe(FORMATS[MotionFormat.Vertical].height);
    expect(doc.tracks.map((t) => t.kind)).toEqual(['visual', 'audio']);
  });

  it('accepts a doc it produced', () => {
    expect(parseMotionDoc(newMotionDoc(MotionFormat.Landscape)).ok).toBe(true);
  });

  it('refuses a doc longer than the limit', () => {
    const doc = { ...newMotionDoc(MotionFormat.Square), durationInFrames: MAX_FRAMES + 1 };

    expect(parseMotionDoc(doc).ok).toBe(false);
  });

  it('refuses a clip of an unknown component', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const tracks = [{ ...doc.tracks[0], clips: [clip('Nope')] }, doc.tracks[1]];

    expect(parseMotionDoc({ ...doc, tracks }).ok).toBe(false);
  });

  it('fills the defaults of a known component', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const tracks = [{ ...doc.tracks[0], clips: [clip('Title')] }, doc.tracks[1]];
    const parsed = parseMotionDoc({ ...doc, tracks });

    expect(parsed.ok && parsed.doc.tracks[0].clips[0].props.text).toBeTypeOf('string');
  });

  it('refuses props the component does not take', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const tracks = [{ ...doc.tracks[0], clips: [{ ...clip('Title'), props: { size: 'huge' } }] }, doc.tracks[1]];

    expect(parseMotionDoc({ ...doc, tracks }).ok).toBe(false);
  });

  it('refuses a resolution above 1080p', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), width: 3840, height: 2160 };

    expect(parseMotionDoc(doc).ok).toBe(false);
  });
});
