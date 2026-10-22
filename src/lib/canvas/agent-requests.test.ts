import { describe, expect, it } from 'vitest';
import { Answer, answerAgent, framesUrl, type FramesAnswer } from './agent-requests';
import { CHECK_REQUEST, DOC_EDITED, FRAMES_REQUEST } from '$lib/motion/frames-request';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { CheckState } from '$lib/motion/custom/component';

const doc: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), fps: 30, durationInFrames: 60 };

function recorder() {
  const sent: FramesAnswer[] = [];
  const drawn: number[][] = [];
  const ports = {
    frames: async (_d: MotionDoc, times: number[]) => {
      drawn.push(times);
      return times.map((time) => ({ time, data: `jpeg@${time}` }));
    },
    check: async () => ({ check: { hash: 'h', state: CheckState.Failed, problems: ['blank frame'] }, offending: [{ time: 1, data: 'bad' }] }),
    send: async (answer: FramesAnswer) => {
      sent.push(answer);
    }
  };
  return { sent, drawn, ports };
}

describe('answerAgent', () => {
  it('draws the frames the agent asked for and sends them back under its call id', async () => {
    const { sent, drawn, ports } = recorder();
    const last = 59 / 30;

    const answer = await answerAgent({ type: FRAMES_REQUEST, data: { callId: 'c1', times: [0, 9], doc } }, ports);

    expect(answer).toBe(Answer.Sent);
    expect(drawn).toEqual([[0, last]]);
    expect(sent).toEqual([{ callId: 'c1', frames: [{ time: 0, data: 'jpeg@0' }, { time: last, data: `jpeg@${last}` }] }]);
  });

  it('checks a custom component and sends the verdict with the offending frames', async () => {
    const { sent, ports } = recorder();

    await answerAgent({ type: CHECK_REQUEST, data: { callId: 'c2', name: 'Orb', doc } }, ports);

    expect(sent).toEqual([{ callId: 'c2', frames: [{ time: 1, data: 'bad' }], verdict: { ok: false, problems: ['blank frame'] } }]);
  });

  it('leaves every other stream part alone', async () => {
    const { sent, ports } = recorder();

    expect(await answerAgent({ type: DOC_EDITED, data: { edit: 1, doc } }, ports)).toBe(Answer.NotARequest);
    expect(sent).toEqual([]);
  });

  it('answers on the frame the request was about', () => {
    expect(framesUrl('p1', 'n1')).toBe('/api/v1/projects/p1/motion/n1/agent/frames');
  });
});
