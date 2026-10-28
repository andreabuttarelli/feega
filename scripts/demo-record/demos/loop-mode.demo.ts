import { test, expect } from '../../../tests/e2e/fixtures/session';
import type { Page } from '@playwright/test';
import { installCursor, recordDemo } from '../record';
import { frameDoc, frameHost, openCanvas, seedFrame } from './seed';

const FPS = 30;
const FRAMES = 120;
const OUT_SECONDS = 2;

const clips = [
  { id: 'dot', from: 0, durationInFrames: FRAMES, component: 'Text', props: { text: 'Morning Mug', size: 0.09, weight: 600, color: '#111111', font: 'sans', x: 0.2, y: 0.5, width: 0.5, height: 0.15 }, keyframes: { x: [{ frame: 0, value: 0.2, ease: 'standard' }, { frame: 30, value: 0.8, ease: 'standard' }] } }
];

const shownSeconds = async (page: Page) => Number((await page.getByTestId('frame-timeline-time').innerText()).replace('s', ''));

async function sampleSeconds(page: Page, ms: number): Promise<number[]> {
  const seen: number[] = [];
  for (let t = 0; t < ms; t += 100) {
    seen.push(await shownSeconds(page));
    await page.waitForTimeout(100);
  }
  return seen;
}

test.setTimeout(240_000);

test('loop a frame: region, seamless, play', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, frameDoc(clips, {}, FRAMES));
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  const box = (await frameHost(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
  await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });

  const outEdge = page.getByTestId('work-area-out');
  const twoSeconds = page.getByText('00:02').first();
  const b = (await twoSeconds.boundingBox())!;
  const out = (await outEdge.boundingBox())!;

  await recordDemo(page, { slug: 'loop-mode', title: 'loop it, seamlessly' }, async (d) => {
    await d.drag(outEdge, { x: b.x + b.width / 2, y: out.y + out.height / 2 });
    await expect(page.getByTestId('frame-timeline-clear-loop')).toBeVisible();
    await d.click(page.getByTestId('frame-timeline-seamless'));
    await d.wait(600);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(5000);
    await d.click(page.getByTestId('frame-timeline-play'));
  });

  const saved = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
  const doc = saved.data!.doc as { workArea: { from: number; to: number } | null; tracks: { clips: { keyframes: Record<string, { frame: number; value: number }[]> }[] }[] };
  expect(doc.workArea?.from).toBe(0);
  const to = doc.workArea!.to;
  expect(Math.abs(to - OUT_SECONDS * FPS)).toBeLessThanOrEqual(8);
  expect(doc.tracks[0].clips[0].keyframes.x.at(-1)).toEqual(expect.objectContaining({ frame: to, value: 0.2 }));

  await page.getByTestId('frame-timeline-play').click();
  const looped = await sampleSeconds(page, 4000);
  await page.getByTestId('frame-timeline-play').click();
  expect(Math.max(...looped)).toBeLessThan(to / FPS);
  expect(looped.some((s, i) => i > 0 && s < looped[i - 1])).toBe(true);

  await page.getByTestId('frame-timeline-loop').click();
  await expect(page.getByTestId('frame-timeline-loop')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('frame-timeline-play').click();
  const once = await sampleSeconds(page, 3500);
  expect(once.at(-1)).toBeCloseTo((to - 1) / FPS, 1);
  expect(once.some((s, i) => i > 0 && s < once[i - 1])).toBe(false);
});
