import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { CRITIC_SHOWN_MAX, PASS_SCORE, critiqueTimes, parseVerdict, sampleTimes, stillSpans } from './critic';

function docWithScenes(cuts: number[], seconds = 15): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Landscape);
  const fps = doc.fps;
  const bounds = [0, ...cuts, seconds];
  const clips = bounds.slice(0, -1).map((start, i) => ({ id: `s${i}`, component: 'Title', from: Math.round(start * fps), durationInFrames: Math.round((bounds[i + 1] - start) * fps), props: { text: `scene ${i}` } }));
  return { ...doc, durationInFrames: seconds * fps, tracks: [{ ...doc.tracks[0], clips }, ...doc.tracks.slice(1)] } as MotionDoc;
}

describe('which frames the critic looks at', () => {
  it('samples the whole video every quarter second, never the exact first or last frame', () => {
    const times = sampleTimes(docWithScenes([5, 10]));

    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)!).toBeLessThan(15);
    expect(times[1] - times[0]).toBeCloseTo(0.25, 6);
  });

  it('shows the critic every second plus both sides of every cut', () => {
    const doc = docWithScenes([4, 9.5]);
    const shown = critiqueTimes(doc, sampleTimes(doc));

    for (const cut of [4, 9.5]) {
      expect(shown.some((t) => t < cut && cut - t <= 0.3)).toBe(true);
      expect(shown.some((t) => t > cut && t - cut <= 0.3)).toBe(true);
    }
    expect(shown.filter((t) => t > 10 && t < 15).length).toBeGreaterThanOrEqual(4);
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
  });

  it('never shows more frames than the critic budget', () => {
    const doc = docWithScenes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 15);

    expect(critiqueTimes(doc, sampleTimes(doc)).length).toBeLessThanOrEqual(CRITIC_SHOWN_MAX);
  });
});

describe('pictures that hold still', () => {
  const sig = (v: number) => new Uint8Array(16).fill(v);

  it('flags a span where nothing moves for more than a second', () => {
    const samples = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((time, i) => ({ time, signature: sig(i < 2 ? i * 40 : 200) }));

    expect(stillSpans(samples, 15)).toEqual([{ from: 0.75, to: 2 }]);
  });

  it('lets a moving picture through', () => {
    const samples = [0.25, 0.5, 0.75, 1, 1.25, 1.5].map((time, i) => ({ time, signature: sig(i * 20) }));

    expect(stillSpans(samples, 1.75)).toEqual([]);
  });

  it('allows the end card to hold at the end of the video', () => {
    const samples = [12, 12.25, 12.5, 12.75, 13, 13.25, 13.5, 13.75, 14, 14.25, 14.5, 14.75].map((time, i) => ({ time, signature: sig(i < 4 ? i * 30 : 250) }));

    expect(stillSpans(samples, 15)).toEqual([]);
  });
});

describe('the critic verdict', () => {
  it('reads the verdict the critic wrote', () => {
    const text = 'Looking closely...\n```json\n{"score": 8.5, "pass": true, "fixes": []}\n```';

    expect(parseVerdict(text, [])).toEqual({ pass: true, score: 8.5, fixes: [] });
  });

  it('fails a video with an objective problem whatever the critic said', () => {
    const text = '{"score": 9, "pass": true, "fixes": []}';

    const verdict = parseVerdict(text, ['the frame at 3s is a flat colour: nothing is on screen']);

    expect(verdict.pass).toBe(false);
    expect(verdict.fixes).toContain('the frame at 3s is a flat colour: nothing is on screen');
  });

  it("puts the critic's own fixes first and keeps at most three measured ones", () => {
    const measured = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const text = JSON.stringify({ score: 4, pass: false, fixes: ['add a wow peak at 10 s', 'cut on the beat at 2 s'] });

    expect(parseVerdict(text, measured).fixes).toEqual(['add a wow peak at 10 s', 'cut on the beat at 2 s', 'm1', 'm2', 'm3']);
  });

  it('fails a score under the bar even when the critic says pass', () => {
    expect(parseVerdict(`{"score": ${PASS_SCORE - 1}, "pass": true, "fixes": ["x"]}`, []).pass).toBe(false);
  });

  it('turns an unreadable answer into a failing verdict that asks for another look', () => {
    const verdict = parseVerdict('I think it is fine', []);

    expect(verdict.pass).toBe(false);
    expect(verdict.score).toBe(0);
  });
});
