import { compOf, findClip, type MotionClip, type MotionDoc } from '../doc';
import { groupClips, ungroupClip } from '../group';
import { setProps, type OpResult } from '../timeline';
import { combineShapes, shapesOf } from './boolean';
import { BooleanOp } from './boolean-op';

type NewId = () => string;

const MIN_SHAPES = 2;
const FRAME = 0;
const OPS: ReadonlySet<string> = new Set(Object.values(BooleanOp));

const fail = (error: string): OpResult => ({ ok: false, error });

export const isBooleanGroup = (clip: MotionClip): boolean => clip.component === 'Precomp' && OPS.has(String(clip.props.boolean));

export function liveCombine(doc: MotionDoc, ids: readonly string[], op: BooleanOp, newId: NewId): OpResult {
  const shapes = shapesOf(doc, ids, MIN_SHAPES);
  if (typeof shapes === 'string') {
    return fail(shapes);
  }
  const [comp, host] = [newId(), newId()];
  const queue = [comp, host];
  const grouped = groupClips(doc, ids, () => queue.shift()!);
  return grouped.ok ? setProps(grouped.doc, host, { boolean: op }) : grouped;
}

export function bakeBooleanGroup(doc: MotionDoc, hostId: string, newId: NewId): OpResult {
  const host = findClip(doc, hostId)?.clip;
  const comp = host ? compOf(host) : null;
  if (!host || !comp || !isBooleanGroup(host)) {
    return fail(`${hostId} is not a boolean group`);
  }
  const shapes = doc.comps[comp].tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.component === 'Shape').map((c) => c.id));
  const released = ungroupClip(doc, hostId, newId);
  return released.ok ? combineShapes(released.doc, shapes, host.props.boolean as BooleanOp, FRAME) : released;
}
