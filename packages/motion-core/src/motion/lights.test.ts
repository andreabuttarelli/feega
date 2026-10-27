import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { cameraMath, stageSpec } from './camera';
import { setCamera, setClipDepth } from './camera-ops';
import { sampleTrack } from './keyframes';
import { Ease } from './design';
import { addClip, setTransform, setKeyframes, type OpResult } from './timeline';
import { StageLightKind } from './lights';
import { addStageLight, setStageLight, setAcceptsLights } from './lights-ops';

const math = cameraMath(sampleTrack);

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function scene(kind: `${StageLightKind}`, props: Record<string, unknown> = {}, transform: Record<string, number> = {}) {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60 }, 'card'));
  doc = must(setCamera(doc, {}));
  doc = must(addStageLight(doc, { kind, from: 0, durationInFrames: 60, props, transform }, 'lamp'));
  return doc;
}

const litAt = (doc: MotionDoc, frame = 0) => math.frameAt(stageSpec(doc), frame).layers.find((l) => l.id === 'card')!.light;

describe('lights in the camera world', () => {
  it('a light is never drawn as a layer of the stage', () => {
    const ids = stageSpec(scene(StageLightKind.Ambient)).layers.map((l) => l.id);

    expect(ids).toEqual(['card']);
  });

  it('without a light a layer is not shaded', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60 }, 'card'));
    doc = must(setCamera(doc, {}));

    expect(litAt(doc)).toBeNull();
  });

  it('ambient light lights every layer evenly, in its colour and intensity', () => {
    const doc = scene(StageLightKind.Ambient, { color: '#ff0000', intensity: 0.5 });

    expect(litAt(doc)).toEqual([0.5, 0, 0]);
  });

  it('a point light in front of a layer facing it lights it fully, one behind it leaves it dark', () => {
    const front = scene(StageLightKind.Point);
    const behind = must(setClipDepth(front, 'lamp', { depth: 800 }));
    const ahead = must(setClipDepth(front, 'lamp', { depth: -500 }));

    expect(litAt(ahead)).toEqual([1, 1, 1]);
    expect(litAt(behind)).toEqual([0, 0, 0]);
  });

  it('a layer turned away from a light is lit by the cosine of the angle (Lambert)', () => {
    let doc = must(setClipDepth(scene(StageLightKind.Point), 'lamp', { depth: -500 }));
    doc = must(setTransform(doc, 'card', { rotateY: 60 }));

    expect(litAt(doc)![0]).toBeCloseTo(0.5, 2);
  });

  it('falloff dims a point light with distance', () => {
    const near = must(setClipDepth(scene(StageLightKind.Point, { falloff: 500 }), 'lamp', { depth: -500 }));
    const far = must(setClipDepth(scene(StageLightKind.Point, { falloff: 500 }), 'lamp', { depth: -1000 }));

    expect(litAt(near)![0]).toBeCloseTo(0.5, 2);
    expect(litAt(far)![0]).toBeLessThan(litAt(near)![0]);
  });

  it('a parallel light shades by its aim and ignores distance', () => {
    const facing = must(setClipDepth(scene(StageLightKind.Parallel), 'lamp', { depth: 3000 }));
    const slanted = must(setTransform(facing, 'lamp', { rotateY: 60 }));

    expect(litAt(facing)).toEqual([1, 1, 1]);
    expect(litAt(slanted)![0]).toBeCloseTo(0.5, 2);
  });

  it('a spot light lights inside its cone, feathers at the edge, and leaves the rest dark', () => {
    const base = must(setClipDepth(scene(StageLightKind.Spot, { coneAngle: 60, coneFeather: 0.5 }), 'lamp', { depth: -1000 }));
    const moved = (offset: number) => must(setTransform(base, 'lamp', { x: offset }));

    expect(litAt(moved(0))).toEqual([1, 1, 1]);
    expect(litAt(moved(0.25))![0]).toBeGreaterThan(0);
    expect(litAt(moved(0.25))![0]).toBeLessThan(1);
    expect(litAt(moved(1.5))).toEqual([0, 0, 0]);
  });

  it('a layer that does not accept lights is drawn as it is', () => {
    const doc = must(setAcceptsLights(scene(StageLightKind.Ambient, { intensity: 0.2 }), 'card', false));

    expect(litAt(doc)).toBeNull();
  });

  it('a light animates through the clip keyframes: intensity and colour', () => {
    let doc = scene(StageLightKind.Ambient, { color: '#000000', intensity: 0 });
    doc = must(setKeyframes(doc, 'lamp', 'intensity', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 40, value: 1, ease: Ease.Linear }]));
    doc = must(setKeyframes(doc, 'lamp', 'color', [{ frame: 0, value: '#000000', ease: Ease.Linear }, { frame: 40, value: '#ffffff', ease: Ease.Linear }]));

    expect(litAt(doc, 0)).toEqual([0, 0, 0]);
    expect(litAt(doc, 20)![0]).toBeCloseTo(0.25, 2);
    expect(litAt(doc, 40)).toEqual([1, 1, 1]);
  });

  it('a light shades only while its clip is on screen', () => {
    const doc = scene(StageLightKind.Ambient, { intensity: 0.5 });

    expect(litAt(doc, 30)).toEqual([0.5, 0.5, 0.5]);
    expect(litAt(doc, 90)).toBeNull();
  });

  it('refuses a colour that is not #rrggbb, and a cone outside the range', () => {
    const doc = scene(StageLightKind.Spot);

    expect(addStageLight(doc, { kind: StageLightKind.Spot, from: 0, props: { color: 'red' } }, 'x').ok).toBe(false);
    expect(addStageLight(doc, { kind: StageLightKind.Spot, from: 0, props: { coneAngle: 400 } }, 'y').ok).toBe(false);
  });

  it('setStageLight edits a light and refuses a clip that is not one', () => {
    const doc = scene(StageLightKind.Point);

    expect(must(setStageLight(doc, 'lamp', { props: { intensity: 2 } })).tracks.flatMap((t) => t.clips).find((c) => c.id === 'lamp')?.props.intensity).toBe(2);
    expect(setStageLight(doc, 'card', { props: { intensity: 2 } }).ok).toBe(false);
  });

  it('the doc with lights still parses', () => {
    expect(parseMotionDoc(scene(StageLightKind.Spot)).ok).toBe(true);
  });
});
