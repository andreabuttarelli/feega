import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { CRITIC_PASS_SCORE, SHEET_MAX_FRAMES, critique, criticMessage, sheetTimes, type CriticPorts } from './critic';
import { tileSheet } from './contact-sheet';
import { MAX_FRAMES_PER_VIEW } from './frames';
import { STUDIO_ROSTER, StudioRole, roleBudgetUsd } from './studio-roster';

const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 30 * 12, fps: 30 as const };

const jpeg = (shade: number) => sharp({ create: { width: 64, height: 36, channels: 3, background: { r: shade, g: shade, b: shade } } }).jpeg().toBuffer();

const ports = (answer: unknown, seen: { times?: number[]; images?: number } = {}): CriticPorts => ({
  frames: async (times) => {
    seen.times = [...(seen.times ?? []), ...times];
    return Promise.all(times.map(async (time) => ({ time, bytes: await jpeg(time * 10) })));
  },
  tile: async (frames) => Buffer.from(`sheet of ${frames.length}`),
  ask: async (input) => {
    seen.images = input.images.length;
    return { answer, usd: 0.05 };
  }
});

describe('the critic', () => {
  it('reviews the whole video, one frame a second, not a few key frames', () => {
    const times = sheetTimes(doc);

    expect(times).toHaveLength(12);
    expect(times[0]).toBe(0.5);
    expect(times.at(-1)).toBe(11.5);
  });

  it('caps a long video to the sheet size, still spanning start to end', () => {
    const times = sheetTimes({ ...doc, durationInFrames: 30 * 120 });

    expect(times).toHaveLength(SHEET_MAX_FRAMES);
    expect(times[0]).toBeLessThan(5);
    expect(times.at(-1)).toBeGreaterThan(115);
  });

  it('sees one contact sheet plus the references, and returns its fix list with the cost', async () => {
    const seen: { times?: number[]; images?: number } = {};
    const out = await critique(ports({ score: 5, fixes: ['scene at 3s is empty: fill it with the product UI'] }, seen), { doc, request: 'trailer for linear.app', references: [{ mediaType: 'image/jpeg', data: 'x' }] });

    expect(seen.times).toEqual(sheetTimes(doc));
    expect(seen.images).toBe(2);
    expect(out.review).toEqual({ score: 5, fixes: ['scene at 3s is empty: fill it with the product UI'] });
    expect(out.usd).toBe(0.05);
  });

  it('draws the sheet in batches the editor accepts, so no frame request is refused', async () => {
    const batches: number[][] = [];
    const out = await critique({ ...ports({ score: 9, fixes: [] }), frames: async (times) => (batches.push(times), times.map((time) => ({ time, bytes: Buffer.from('x') }))) }, { doc, request: 'x', references: [] });

    expect(batches.every((b) => b.length <= MAX_FRAMES_PER_VIEW)).toBe(true);
    expect(batches.flat()).toEqual(sheetTimes(doc));
    expect(out.review?.score).toBe(9);
  });

  it('gives up quietly when no frames can be drawn', async () => {
    const out = await critique({ ...ports({}), frames: async () => null }, { doc, request: 'x', references: [] });

    expect(out).toEqual({ review: null, usd: 0, sheet: null });
  });

  it('drops an answer that does not fit the review shape', async () => {
    const out = await critique(ports({ verdict: 'great' }), { doc, request: 'x', references: [] });

    expect(out.review).toBeNull();
    expect(out.usd).toBe(0.05);
  });

  it('asks for a fix round only when the score is below the pass mark and fixes exist', () => {
    expect(criticMessage({ score: CRITIC_PASS_SCORE, fixes: ['nudge'] })).toBeNull();
    expect(criticMessage({ score: 4, fixes: [] })).toBeNull();
    expect(criticMessage({ score: 4, fixes: ['title at 2s overflows'] })?.content).toContain('- title at 2s overflows');
  });
});

describe('the contact sheet', () => {
  it('tiles every frame into one picture', async () => {
    const frames = await Promise.all([0, 1, 2, 3, 4].map(async (time) => ({ time, bytes: await jpeg(40 * time) })));
    const meta = await sharp(await tileSheet(frames)).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeGreaterThan(64 * 3);
    expect(meta.height).toBeGreaterThan(36);
  });
});

describe('the studio roster', () => {
  it('splits the turn cap between the roles without exceeding it', () => {
    const shares = Object.values(STUDIO_ROSTER).reduce((sum, r) => sum + r.budgetShare, 0);

    expect(shares).toBeCloseTo(1);
    expect(roleBudgetUsd(StudioRole.Critic, 1.5)).toBeCloseTo(1.5 * STUDIO_ROSTER[StudioRole.Critic].budgetShare);
  });
});

describe('the critic measures empty frames on its own sheet', () => {
  const measured = (densities: number[]) => ({ density: async (frames: readonly { time: number }[]) => frames.map((_, i) => densities[i] ?? 0.5) });

  it('turns a passing review into fixes when frames are mostly empty (v4: the score passed with half-empty shots)', async () => {
    const out = await critique({ ...ports({ score: 9, fixes: [] }), ...measured([0.001, 0.5, 0.004]) }, { doc, request: 'x', references: [] });

    expect(out.review?.score).toBeLessThan(CRITIC_PASS_SCORE);
    expect(out.review?.fixes).toEqual([expect.stringMatching(/^0\.5s: .*empty/), expect.stringMatching(/^2\.5s: .*empty/)]);
    expect(out.review && criticMessage(out.review)).not.toBeNull();
  });

  it('leaves a full video to the critic alone', async () => {
    const out = await critique({ ...ports({ score: 9, fixes: [] }), ...measured([]) }, { doc, request: 'x', references: [] });

    expect(out.review).toEqual({ score: 9, fixes: [] });
  });
});
