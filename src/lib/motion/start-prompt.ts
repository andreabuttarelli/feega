import type { MotionDoc } from './doc';

export enum Agent {
  Idle = 'idle',
  Working = 'working'
}

export function showsStart(doc: MotionDoc, agent: Agent): boolean {
  return agent === Agent.Idle && doc.tracks.every((t) => !t.clips.length);
}
