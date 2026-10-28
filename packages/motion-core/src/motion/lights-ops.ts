import type { MotionDoc } from './doc';
import { NEW_LIGHT_DEPTH, type StageLightKind } from './lights';
import { editClip, addClip, setProps, setTransform, type OpResult } from './timeline';
import type { Transform } from './keyframes';

const LIGHT = 'Light';

export type NewLight = {
  kind: `${StageLightKind}`;
  from: number;
  durationInFrames?: number;
  trackId?: string;
  props?: Record<string, unknown>;
  transform?: Transform;
};

const fail = (error: string): OpResult => ({ ok: false, error });

export function addStageLight(doc: MotionDoc, input: NewLight, id: string): OpResult {
  const added = addClip(doc, { component: LIGHT, from: input.from, durationInFrames: input.durationInFrames, trackId: input.trackId, props: { ...input.props, kind: input.kind }, transform: input.transform }, id);
  return added.ok ? editClip(added.doc, id, (clip) => ({ ...clip, depth: NEW_LIGHT_DEPTH })) : added;
}

export type LightPatch = { props?: Record<string, unknown>; transform?: Transform; depth?: number };

export function setStageLight(doc: MotionDoc, clipId: string, patch: LightPatch): OpResult {
  const clip = doc.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
  if (clip?.component !== LIGHT) {
    return fail(`${clipId} is not a light`);
  }

  const withProps = patch.props ? setProps(doc, clipId, patch.props) : { ok: true as const, doc };
  const withTransform = withProps.ok && patch.transform ? setTransform(withProps.doc, clipId, patch.transform) : withProps;

  return withTransform.ok && patch.depth !== undefined ? editClip(withTransform.doc, clipId, (c) => ({ ...c, depth: patch.depth! })) : withTransform;
}

export function setAcceptsLights(doc: MotionDoc, clipId: string, accepts: boolean): OpResult {
  return editClip(doc, clipId, (clip) => ({ ...clip, acceptsLights: accepts }));
}
