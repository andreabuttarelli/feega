import type { MotionClip, MotionDoc } from '$lib/motion/doc';
import { Sfx, sfxLabel, type SfxCue } from '$lib/motion/sfx';
import { AssetKind } from '$lib/motion/components';
import { placeSfx } from '$lib/motion/shots/ops';
import type { OpResult } from '$lib/motion/timeline';
import type { SfxAsset } from './motion-tools';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { instanceComp } from '$lib/motion/template/library';
import { locateClip } from '$lib/motion/template/fields';
import { PROMPT_COMPONENT } from '$lib/motion/template/prompt-input/component';
import { PROMPT_MODEL } from '$lib/motion/template/prompt-input/model';

type Keyed = { at: number };
type PromptPlan = { keys: Keyed[]; pressAt: number; press: boolean };

const promptPlan = new Function(`${PROMPT_MODEL}; return promptPlan;`)() as (props: Record<string, unknown>, seconds: number) => PromptPlan;

const SOUNDS: Record<string, (props: Record<string, unknown>, seconds: number) => SfxCue[]> = {
  [PROMPT_COMPONENT]: (props, seconds) => {
    const plan = promptPlan(props, seconds);
    const keys = plan.keys.map((k) => ({ sfx: Sfx.Key, at: k.at }));
    return plan.press ? [...keys, { sfx: Sfx.Click, at: plan.pressAt }] : keys;
  }
};

export function templateCues(doc: MotionDoc, clipId: string): SfxCue[] {
  const host = locateClip(doc, clipId)?.clip;
  const comp = instanceComp(doc, clipId)?.comp;
  if (!host || !comp) {
    return [];
  }
  const clips = comp.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Custom' && SOUNDS[String(c.props.name)]);
  return clips
    .flatMap((c) => {
      const name = String(c.props.name);
      const component = doc.components[name];
      const values = component ? customValues(component, c.props, Strictness.Lenient) : null;
      if (!values?.ok) {
        return [];
      }
      const start = (host.from + c.from) / doc.fps;
      return SOUNDS[name](values.values, c.durationInFrames / doc.fps).map((cue) => ({ ...cue, at: cue.at + start }));
    })
    .sort((a, b) => a.at - b.at);
}

export type SfxMaker = (sfx: Sfx) => Promise<SfxAsset>;


async function sfxAssets(doc: MotionDoc, kinds: Sfx[], make: SfxMaker): Promise<{ doc: MotionDoc; ids: Partial<Record<Sfx, string>> } | { error: string }> {
  let next = doc;
  const ids: Partial<Record<Sfx, string>> = {};
  for (const kind of kinds) {
    const known = next.assets.find((a) => a.name === sfxLabel(kind));
    if (known) {
      ids[kind] = known.id;
      continue;
    }
    const made = await make(kind);
    if (!made.ok) {
      return { error: made.error };
    }
    ids[kind] = made.assetId;
    next = { ...next, assets: [...next.assets, { id: made.assetId, kind: AssetKind.Audio, name: sfxLabel(kind) }] };
  }
  return { doc: next, ids };
}

export async function withTemplateSounds(doc: MotionDoc, clipId: string, make: SfxMaker, newId: () => string): Promise<OpResult> {
  const cues = templateCues(doc, clipId);
  if (!cues.length) {
    return { ok: true, doc };
  }
  const made = await sfxAssets(doc, [...new Set(cues.map((c) => c.sfx))], make);
  return 'error' in made ? { ok: false, error: made.error } : placeSfx(made.doc, cues, made.ids, newId);
}
