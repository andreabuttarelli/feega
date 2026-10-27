import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { ClipError } from '@feega/motion-core/motion/hyperframes/capture';
import { CheckState, sourceHash, type ComponentCheck } from '@feega/motion-core/motion/custom/component';
import type { Boxes } from '@feega/motion-core/motion/custom/reflow';
import { checkDoc, seekPlan, verdictOf, type Luma, type Shot } from './determinism';

export type CheckShot = { time: number; data: string; layout: string; boxes?: Boxes; errors: ClipError[] };

export type CheckPorts = {
  compose: (doc: MotionDoc) => string;
  capture: (times: number[], html: string) => Promise<CheckShot[]>;
  luma: (data: string) => Promise<Luma>;
};

export type CheckRun = { check: ComponentCheck; offending: { time: number; data: string }[] };

export async function runCheck(doc: MotionDoc, name: string, ports: CheckPorts): Promise<CheckRun> {
  const alone = checkDoc(doc, name);
  const hash = sourceHash(doc.components[name]);
  const times = seekPlan(alone.durationInFrames / alone.fps, alone.fps);

  let shots: Shot[];
  try {
    const captured = await ports.capture(times, ports.compose(alone));
    shots = await Promise.all(captured.map(async (s) => ({ time: s.time, image: s.data, luma: await ports.luma(s.data), layout: s.layout, boxes: s.boxes, errors: s.errors })));
  } catch (e) {
    return { check: { hash, state: CheckState.Failed, problems: [`the preview could not render it: ${e instanceof Error ? e.message : String(e)}`] }, offending: [] };
  }

  const verdict = verdictOf(shots);
  return {
    check: { hash, state: verdict.ok ? CheckState.Passed : CheckState.Failed, problems: verdict.problems },
    offending: verdict.offending.map((s) => ({ time: s.time, data: s.image }))
  };
}
