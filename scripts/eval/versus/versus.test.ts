import { describe, expect, it } from 'vitest';
import { blackShare, cutFrames, freezes, joltCounts, loopSeam, parseProbe } from './facts';
import { Arm, Outcome, Pick, byForfeit, settle, toArms, type PairVerdict } from './judge';
import { failureOf, parseUsage, type PlainResult } from './plain-result';
import { feegaUsage, stalled } from './feega';

const side = { fidelity: 7, legible: true };
const verdict = (winner: Pick): PairVerdict => ({ winner, reason: 'r', first: { fidelity: 8, legible: true }, second: { fidelity: 3, legible: false } });

describe('facts read from a video', () => {
  it('fps comes from avg_frame_rate, and a 0/0 rate falls back to r_frame_rate', () => {
    const probe = (avg: string) => JSON.stringify({ streams: [{ codec_type: 'audio' }, { codec_type: 'video', width: 1080, height: 1920, avg_frame_rate: avg, r_frame_rate: '30/1' }], format: { duration: '12.5' } });
    expect(parseProbe(probe('30000/1001'))).toEqual({ width: 1080, height: 1920, fps: 29.97, duration: 12.5 });
    expect(parseProbe(probe('0/0')).fps).toBe(30);
  });

  it('a hard cut is not counted as a jolt, a lone spike inside smooth motion is', () => {
    const smooth = Array.from({ length: 40 }, () => 2);
    const withCut = [...smooth.slice(0, 20), 80, ...smooth.slice(21)];
    expect(cutFrames(withCut)).toEqual([20]);
    expect(joltCounts(withCut).pops).toBe(0);
    const withPop = [...smooth.slice(0, 20), 12, ...smooth.slice(21)];
    expect(joltCounts(withPop).pops).toBe(1);
  });

  it('the longest freeze is the longest run of still frames, in seconds', () => {
    expect(freezes([1, 0, 0, 0, 1, 0], 30)).toEqual({ longestFreezeS: 3 / 30, frozenShare: 4 / 6 });
    expect(freezes([], 30)).toEqual({ longestFreezeS: null, frozenShare: null });
  });

  it('black frames are those whose mean luma is under the floor', () => {
    expect(blackShare([new Uint8Array([0, 4]), new Uint8Array([200, 200])])).toBe(0.5);
  });

  it('a loop whose last frame equals the first has no seam; one that jumps does', () => {
    const a = new Uint8Array([10, 10]);
    expect(loopSeam([a, new Uint8Array([12, 12]), a], [2, 2])).toBe(0);
    expect(loopSeam([a, new Uint8Array([12, 12]), new Uint8Array([90, 90])], [2, 2])).toBeGreaterThan(3);
  });
});

describe('the blind pairwise judge', () => {
  it('maps first/second back to the arms that were shown in that order', () => {
    expect(toArms(verdict(Pick.First), Arm.Feega).winner).toBe(Arm.Feega);
    expect(toArms(verdict(Pick.First), Arm.Plain).sides.plain).toEqual({ fidelity: 8, legible: true });
    expect(toArms(verdict(Pick.Tie), Arm.Plain).winner).toBeNull();
  });

  it('counts a verdict only when both orders agree: position bias is not a win', () => {
    const feegaFirst = toArms(verdict(Pick.First), Arm.Feega);
    const plainFirst = toArms(verdict(Pick.First), Arm.Plain);
    expect(settle(feegaFirst, plainFirst)).toBe(Outcome.Inconsistent);
    expect(settle(feegaFirst, toArms(verdict(Pick.Second), Arm.Plain))).toBe(Outcome.FeegaWins);
    expect(settle({ winner: null, reason: '', sides: { plain: side, feega: side } }, { winner: null, reason: '', sides: { plain: side, feega: side } })).toBe(Outcome.Tie);
  });

  it('an arm without a video loses without being judged', () => {
    expect(byForfeit({ plain: true, feega: false })).toBe(Outcome.PlainWins);
    expect(byForfeit({ plain: false, feega: true })).toBe(Outcome.FeegaWins);
    expect(byForfeit({ plain: true, feega: true })).toBeNull();
  });
});

describe('usage of each arm', () => {
  it('plain usage comes from the claude -p JSON result', () => {
    const raw = JSON.stringify({ total_cost_usd: 1.5, usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 300, cache_creation_input_tokens: 40 } });
    expect(parseUsage(raw)).toEqual({ inputTokens: 10, outputTokens: 20, cacheReadTokens: 300, cacheWriteTokens: 40, costUsd: 1.5 });
    expect(parseUsage('not json')).toBeNull();
  });

  it('a plain run with no out.mp4 says why', () => {
    const r: PlainResult = { work: '/t', exitCode: 1, timedOut: false, wallS: 3, video: false, raw: JSON.stringify({ subtype: 'error_max_budget_usd' }), stderr: '' };
    expect(failureOf(r)).toBe('no out.mp4 (exit 1, error_max_budget_usd)');
    expect(failureOf({ ...r, timedOut: true })).toMatch(/30 min/);
    expect(failureOf({ ...r, video: true })).toBeNull();
  });

  it('feega usage sums ai_calls', () => {
    expect(feegaUsage([{ prompt_tokens: 5, completion_tokens: 1, cached_tokens: 2, cost_usd: 0.5 }, { prompt_tokens: null, completion_tokens: 3, cached_tokens: null, cost_usd: 0.25 }])).toEqual({ inputTokens: 5, outputTokens: 4, cacheReadTokens: 2, cacheWriteTokens: 0, costUsd: 0.75 });
  });

  it('a feega turn that spent nothing for 8 minutes is a stall, not a slow turn', () => {
    expect(stalled([{ atS: 300, spentUsd: 0, running: true, messages: 1 }])).toBeNull();
    expect(stalled([{ atS: 500, spentUsd: 0.1, running: true, messages: 3 }])).toBeNull();
    expect(stalled([{ atS: 500, spentUsd: 0, running: false, messages: 1 }])).toMatch(/stalled/);
  });
});
