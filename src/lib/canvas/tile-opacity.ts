import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { setTransform, type OpResult } from '@feega/motion-core/motion/timeline';

const rootsOf = (doc: MotionDoc): string[] => doc.tracks.flatMap((t) => t.clips.filter((c) => !c.parent).map((c) => c.id));

export const tileFaded = (doc: MotionDoc, opacity: number): OpResult => rootsOf(doc).reduce<OpResult>((r, id) => (r.ok ? setTransform(r.doc, id, { opacity }) : r), { ok: true, doc });
