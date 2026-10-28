import { readsInput, type InputValues } from '../expression/inputs';
import { Ease } from '../design';
import type { MotionClip, MotionDoc } from '../doc';
import { liveSpecOf, type ComposeInput } from '../hyperframes/compose';
import type { Prepared } from '../gpu-full/display-list';
import type { Keyframe } from '../keyframes';
import { laneName, liveScene } from './live';
import { interactiveOf } from './settings';
import { defaultsOf, type VarValues } from './var-model';

export type LiveInputs = { values: InputValues; vars: VarValues };

export type LiveFeed = { apply: (prepared: Prepared, frame: number, inputs: LiveInputs, dtSeconds: number) => Prepared };

type Patch = { keyframes: Record<string, Keyframe[]>; props: Record<string, unknown> };

const held = (value: number): Keyframe[] => [{ frame: 0, value, ease: Ease.Linear }];

const patchOf = (patches: Map<string, Patch>, id: string): Patch => patches.get(id) ?? patches.set(id, { keyframes: {}, props: {} }).get(id)!;

function patched(doc: MotionDoc, patches: Map<string, Patch>): MotionDoc {
  const withPatch = (clip: MotionClip): MotionClip => {
    const patch = patches.get(clip.id);
    return patch ? { ...clip, keyframes: { ...clip.keyframes, ...patch.keyframes }, props: { ...clip.props, ...patch.props } } : clip;
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => withPatch(c as MotionClip)) })) } as MotionDoc;
}

const mayReadInput = (doc: MotionDoc) => readsInput(JSON.stringify([doc.tracks, doc.comps]));

export function liveFeed(raw: ComposeInput): LiveFeed | null {
  const { bindings, vars: declared } = interactiveOf(raw.doc);
  if (!bindings.length && !mayReadInput(raw.doc)) {
    return null;
  }
  const spec = liveSpecOf(raw);
  if (!spec.live.length && !bindings.length) {
    return null;
  }
  const scene = liveScene(spec);
  const defaults = defaultsOf(declared);
  let kept: { base: Prepared; key: string; made: Prepared } | null = null;

  return {
    apply(base, frame, inputs, dtSeconds) {
      const vars = { ...defaults, ...inputs.vars };
      const lanes = scene.tick(inputs.values, frame, dtSeconds, vars);
      const key = JSON.stringify([frame, [...lanes], bindings.map((b) => vars[b.var])]);
      if (kept?.base === base && kept.key === key) {
        return kept.made;
      }
      const patches = new Map<string, Patch>();
      for (const lane of scene.lanes) {
        const value = lanes.get(laneName(lane));
        if (value !== undefined) {
          patchOf(patches, lane.id).keyframes[lane.key] = held(value);
        }
      }
      for (const b of bindings) {
        patchOf(patches, b.clip).props[b.prop] = vars[b.var];
      }
      const made = { ...base, doc: patched(base.doc, patches) };
      kept = { base, key, made };
      return made;
    }
  };
}
