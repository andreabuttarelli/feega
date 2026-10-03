import type { MotionDoc } from '../doc';
import type { ClipError } from '../hyperframes/capture';
import { CheckState, sourceHash, type ComponentCheck } from './component';
import { checkDoc, seekPlan, verdictOf, type Shot } from './determinism';

export type CheckShot = { time: number; data: string; layout: string; errors: ClipError[] };

export type CheckPorts = {
  compose: (doc: MotionDoc) => string;
  capture: (times: number[], html: string) => Promise<CheckShot[]>;
};

export type CheckRun = { check: ComponentCheck; offending: { time: number; data: string }[] };

export async function runCheck(doc: MotionDoc, name: string, ports: CheckPorts): Promise<CheckRun> {
  const alone = checkDoc(doc, name);
  const hash = sourceHash(doc.components[name]);
  const times = seekPlan(alone.durationInFrames / alone.fps, alone.fps);

  let shots: Shot[];
  try {
    shots = (await ports.capture(times, ports.compose(alone))).map((s) => ({ time: s.time, image: s.data, layout: s.layout, errors: s.errors }));
  } catch (e) {
    return { check: { hash, state: CheckState.Failed, problems: [`the preview could not render it: ${e instanceof Error ? e.message : String(e)}`] }, offending: [] };
  }

  const verdict = verdictOf(shots);
  return {
    check: { hash, state: verdict.ok ? CheckState.Passed : CheckState.Failed, problems: verdict.problems },
    offending: verdict.offending.map((s) => ({ time: s.time, data: s.image }))
  };
}
