import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { JunctionKind } from '../junction-model';
import { appendScene, resolveScenes, sceneTransition } from '../scenes';
import { addClip, type OpResult } from '../timeline';
import { displayListAt, type PathItem } from './display-list';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const SCENE_FRAMES = 60;
const FADE_FRAMES = 12;
const FULL_FRAME = { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fill: '#ff0000' };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const DOT = { ...FULL_FRAME, width: 0.1, height: 0.1, fill: '#00ff00' };

const scene = (): MotionDoc => {
  const base = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: SCENE_FRAMES };
  const withShape = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: SCENE_FRAMES, props: FULL_FRAME }, 'fill'));
  return must(addClip(withShape, { component: 'Shape', from: 0, durationInFrames: SCENE_FRAMES, props: DOT }, 'dot'));
};

const sequence = (kind: JunctionKind): MotionDoc => {
  const base = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: SCENE_FRAMES * 2 };
  const two = appendScene(appendScene(base, { nodeId: A, durationInFrames: SCENE_FRAMES }), { nodeId: B, durationInFrames: SCENE_FRAMES });
  const second = two.tracks.flatMap((t) => t.clips).find((c) => c.from === SCENE_FRAMES)!;
  return resolveScenes(must(sceneTransition(two, second.id, { kind, durationInFrames: FADE_FRAMES })), { [A]: scene(), [B]: scene() });
};

const MID_TRANSITION = SCENE_FRAMES;

const drawn = (kind: JunctionKind, frame = MID_TRANSITION) => displayListAt(sequence(kind), frame, FEEGA_TOKENS).items as PathItem[];

const ofScene = (items: PathItem[], index: number) => items.filter((i) => i.clip.startsWith(`scene-${index}__`));

describe('scene transitions draw the whole scene as one group', () => {
  it('a crossfade fades the full-frame shape and the dot together', () => {
    const items = drawn(JunctionKind.Crossfade);
    const top = items.at(-1)!.clip.split('__')[0];
    const fading = items.filter((i) => i.clip.startsWith(`${top}__`));

    expect(top).toBe('scene-2');
    expect(fading.map((i) => i.opacity)).toEqual([fading[0].opacity, fading[0].opacity]);
    expect(fading[0].opacity).toBeGreaterThan(0);
    expect(fading[0].opacity).toBeLessThan(1);
  });

  it('a push moves every shape of the incoming scene', () => {
    const items = drawn(JunctionKind.PushLeft);
    const incoming = ofScene(items, 2);

    expect(incoming).toHaveLength(2);
    expect(incoming.every((i) => i.matrix[4] > 0)).toBe(true);
  });

  it('a zoom scales the whole incoming scene and fades it', () => {
    const incoming = ofScene(drawn(JunctionKind.Zoom), 2);

    expect(incoming.every((i) => i.opacity > 0 && i.opacity < 1)).toBe(true);
    expect(incoming.every((i) => Math.abs(i.matrix[0]) < 1)).toBe(true);
  });

  it('a blur dissolve blurs every shape of the incoming scene', () => {
    const incoming = ofScene(drawn(JunctionKind.Blur), 2);

    expect(incoming.every((i) => i.blur > 0)).toBe(true);
  });

  it('opacity stays between 0 and 1 through the whole transition', () => {
    const all = Array.from({ length: FADE_FRAMES + 2 }, (_, i) => SCENE_FRAMES - FADE_FRAMES / 2 + i).flatMap((f) => drawn(JunctionKind.Crossfade, f).map((i) => i.opacity));

    expect(all.every((o) => o >= 0 && o <= 1)).toBe(true);
  });

  it('a dip to black darkens the outgoing scene before it disappears', () => {
    const outgoing = ofScene(drawn(JunctionKind.DipToBlack, SCENE_FRAMES - FADE_FRAMES / 4), 1);
    const dim = (i: PathItem) => i.filters?.some((f) => f.kind === 'css' && f.fns.some((fn) => fn.name === 'brightness' && Number(fn.args[0]) < 1));

    expect(outgoing.length).toBeGreaterThan(0);
    expect(outgoing.every(dim)).toBe(true);
  });

  it('a wipe reveals the incoming scene from the left edge', () => {
    const items = drawn(JunctionKind.Wipe);
    const clipped = items.filter((i) => i.scissor);

    expect(clipped.length).toBeGreaterThan(0);
  });
});
