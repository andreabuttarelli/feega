import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BuiltinFont } from '@feega/motion-core/motion/fonts/model';
import { outlineUrl } from '@feega/motion-core/motion/fonts/outline';
import type { Outliner } from './fonts/outliner';
import { textToPath } from './text-outline';
import type { OpResult } from '@feega/motion-core/motion/timeline';

const REGULAR_WEIGHT = 400;

export type OutlinerLoader = (url: string) => Promise<Outliner | null>;

async function outlineOne(doc: MotionDoc, id: string, load: OutlinerLoader, assets: Record<string, string>): Promise<OpResult> {
  const clip = findClip(doc, id)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${id}` };
  }
  const family = String(clip.props.font ?? BuiltinFont.Sans);
  const url = outlineUrl(family, Number(clip.props.weight ?? REGULAR_WEIGHT), doc.fonts, assets);
  const outliner = url ? await load(url) : null;
  return outliner ? textToPath(doc, id, outliner) : { ok: false, error: `the font ${family} could not be loaded to outline ${id}` };
}

export async function outlineTexts(doc: MotionDoc, ids: readonly string[], load: OutlinerLoader, assets: Record<string, string> = {}): Promise<OpResult> {
  let result: OpResult = { ok: true, doc };
  for (const id of ids) {
    result = result.ok ? await outlineOne(result.doc, id, load, assets) : result;
  }
  return result;
}
