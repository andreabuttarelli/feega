import { CHECK_REQUEST, FRAMES_REQUEST, type CheckRequest, type FramesRequest } from '$lib/motion/frames-request';
import { CheckState } from '$lib/motion/custom/component';
import type { CheckRun } from '$lib/motion/custom/run-check';
import type { MotionDoc } from '$lib/motion/doc';

export type AgentPart = { type: string; data: unknown };
export type DrawnFrame = { time: number; data: string };
export type FramesAnswer = { callId: string; frames: DrawnFrame[]; verdict?: { ok: boolean; problems: string[] } };

export type RequestPorts = {
  frames: (doc: MotionDoc, times: number[]) => Promise<DrawnFrame[]>;
  check: (doc: MotionDoc, name: string) => Promise<CheckRun>;
  send: (answer: FramesAnswer) => Promise<void>;
};

export enum Answer {
  Sent = 'sent',
  NotARequest = 'not-a-request'
}

export const framesUrl = (projectId: string, nodeId: string) => `/api/v1/projects/${projectId}/motion/${nodeId}/agent/frames`;

const lastFrame = (doc: MotionDoc) => (doc.durationInFrames - 1) / doc.fps;

async function drawFrames(request: FramesRequest, ports: RequestPorts) {
  const times = request.times.map((t) => Math.min(t, lastFrame(request.doc)));
  const frames = await ports.frames(request.doc, times);
  await ports.send({ callId: request.callId, frames });
}

async function checkComponent(request: CheckRequest, ports: RequestPorts) {
  const run = await ports.check(request.doc, request.name);
  await ports.send({ callId: request.callId, frames: run.offending, verdict: { ok: run.check.state === CheckState.Passed, problems: run.check.problems } });
}

const ANSWERS: Record<string, (data: unknown, ports: RequestPorts) => Promise<void>> = {
  [FRAMES_REQUEST]: (data, ports) => drawFrames(data as FramesRequest, ports),
  [CHECK_REQUEST]: (data, ports) => checkComponent(data as CheckRequest, ports)
};

export async function answerAgent(part: AgentPart, ports: RequestPorts): Promise<Answer> {
  const answer = ANSWERS[part.type];
  if (!answer) {
    return Answer.NotARequest;
  }

  await answer(part.data, ports);
  return Answer.Sent;
}
