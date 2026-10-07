import { describe, expect, it } from 'vitest';
import { DOC_VERSION, FORMATS, MotionFormat, newMotionDoc, parseMotionDoc, upgradeDoc } from './doc';
import { maxFrames } from './design';

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
    const doc = { ...newMotionDoc(MotionFormat.Square), durationInFrames: maxFrames(30) + 1 };

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

  it('takes a 1440 square for UI reels, and nothing else above 1080p', () => {
    expect(parseMotionDoc(newMotionDoc(MotionFormat.SquareLarge)).ok).toBe(true);
    expect(FORMATS[MotionFormat.SquareLarge]).toMatchObject({ width: 1440, height: 1440 });
    expect(parseMotionDoc({ ...newMotionDoc(MotionFormat.Landscape), width: 1920, height: 1440 }).ok).toBe(false);
  });

  it('a new doc carries the current schema version', () => {
    expect(newMotionDoc(MotionFormat.Square).version).toBe(DOC_VERSION);
  });

  it('a clip keeps its transform and keyframes', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const keyed = { ...clip('Title'), transform: { rotateY: 30, perspective: 800 }, keyframes: { rotateX: [{ frame: 0, value: 0 }, { frame: 20, value: 90, ease: [0.2, 0, 0.2, 1] }] } };
    const parsed = parseMotionDoc({ ...doc, tracks: [{ ...doc.tracks[0], clips: [keyed] }, doc.tracks[1]] });

    expect(parsed.ok && parsed.doc.tracks[0].clips[0].transform).toEqual({ rotateY: 30, perspective: 800 });
    expect(parsed.ok && parsed.doc.tracks[0].clips[0].keyframes.rotateX[0].ease).toBe('standard');
  });

  it('refuses keyframes on a prop the component cannot animate', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const keyed = { ...clip('Title'), keyframes: { orbit: [{ frame: 0, value: 0 }] } };

    expect(parseMotionDoc({ ...doc, tracks: [{ ...doc.tracks[0], clips: [keyed] }, doc.tracks[1]] }).ok).toBe(false);
  });

  it('keyframes come back ordered by frame, one per frame', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const keyed = { ...clip('Title'), keyframes: { rotateZ: [{ frame: 20, value: 2 }, { frame: 0, value: 0 }, { frame: 20, value: 3 }] } };
    const parsed = parseMotionDoc({ ...doc, tracks: [{ ...doc.tracks[0], clips: [keyed] }, doc.tracks[1]] });

    expect(parsed.ok && parsed.doc.tracks[0].clips[0].keyframes.rotateZ.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [20, 3]
    ]);
  });
});

describe('stored docs from older versions', () => {
  const v1 = { fps: 30, width: 1080, height: 1080, durationInFrames: 90, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip('Title')] }], assets: [] };

  it('a doc without a version is version 1 and upgrades to the current one', () => {
    const upgraded = upgradeDoc(v1) as { version: number; tracks: { clips: { transform: unknown; keyframes: unknown }[] }[] };

    expect(upgraded.version).toBe(DOC_VERSION);
    expect(upgraded.tracks[0].clips[0].transform).toEqual({});
    expect(upgraded.tracks[0].clips[0].keyframes).toEqual({});
  });

  it('does not touch its input', () => {
    const before = structuredClone(v1);
    upgradeDoc(v1);

    expect(v1).toEqual(before);
  });

  it('a current doc passes through unchanged', () => {
    const doc = newMotionDoc(MotionFormat.Square);

    expect(upgradeDoc(doc)).toEqual(doc);
  });

  it('loading parses a version 1 doc', () => {
    const parsed = parseMotionDoc(v1);

    expect(parsed.ok && parsed.doc.version).toBe(DOC_VERSION);
  });

  it('refuses a doc from a newer version than this code knows', () => {
    expect(parseMotionDoc({ ...newMotionDoc(MotionFormat.Square), version: DOC_VERSION + 1 }).ok).toBe(false);
  });
});
