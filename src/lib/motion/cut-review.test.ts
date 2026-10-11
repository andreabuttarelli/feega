import { describe, expect, it } from 'vitest';
import { CutAnswer, CutGate, REVIEW_CUT, cutAnswer, cutAnswers, cutGate, pendingReview, reviewAwaits } from './cut-review';

const review = { score: 5, fixes: ['2s: the frame is empty'], sheet: 'o/p/web-views/critic-1/sheet.jpg' };
const tool = { toolName: REVIEW_CUT, output: { ok: true, ...review } };

describe('the cut review gate', () => {
  it('waits on the user after the critic shows its sheet and notes', () => {
    expect(reviewAwaits([{ content: [{ type: 'tool-result', toolName: REVIEW_CUT, output: tool.output }] }])).toBe(true);
    expect(reviewAwaits([{ content: [{ type: 'tool-result', toolName: 'add_clip', output: {} }] }])).toBe(false);
  });

  it('shows the card only on the last finished answer', () => {
    expect(pendingReview([{ role: 'assistant', content: '', tools: [tool] }])).toEqual(review);
    expect(pendingReview([{ role: 'assistant', content: '', tools: [tool] }, { role: 'user', content: 'ok' }])).toBeNull();
    expect(pendingReview([{ role: 'assistant', content: '', tools: [tool], live: true }])).toBeNull();
  });

  it('applying names every fix, so any client (chat, API, MCP) can answer with plain text', () => {
    expect(cutAnswer(CutAnswer.Apply, review.fixes)).toContain('- 2s: the frame is empty');
    expect(cutAnswer(CutAnswer.Ship, review.fixes)).not.toContain('frame is empty');
    expect(Object.keys(cutAnswers(review.fixes)).sort()).toEqual(Object.values(CutAnswer).sort());
  });

  it('asks by default, and stops asking once the user said to go ahead without asking', () => {
    expect(cutGate('make a trailer', [])).toBe(CutGate.Ask);
    expect(cutGate('make a trailer, scegli tu', [])).toBe(CutGate.Auto);
    expect(cutGate('another one', [{ role: 'user', content: cutAnswer(CutAnswer.ApplyAlways, review.fixes) }])).toBe(CutGate.Auto);
    expect(cutGate('another one', [{ role: 'user', content: cutAnswer(CutAnswer.Apply, review.fixes) }])).toBe(CutGate.Ask);
  });
});
