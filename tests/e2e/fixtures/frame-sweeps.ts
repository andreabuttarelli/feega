import type { Page } from '@playwright/test';

export type Frames = { fpsAvg: number; fpsP5: number; p50: number; p95: number; max: number; over8: number; over17: number; over33: number; frames: number; workP95: number };

const PRO_MOTION_MS = 1000 / 120;
const DISPLAY_MS = 1000 / 60;
const DROPPED_MS = 1000 / 30;
const DRAG_STEPS = 60;

export const instrument = () => {
  type Probe = { gaps: number[]; work: number[]; counting: boolean; appFrames: number; mutations: number; perNode: Record<string, number> };
  const probe: Probe = { gaps: [], work: [], counting: false, appFrames: 0, mutations: 0, perNode: {} };
  (window as unknown as { __frames: Probe }).__frames = probe;

  const native = window.requestAnimationFrame.bind(window);
  const channel = new MessageChannel();
  let frameStart = 0;
  channel.port1.onmessage = () => {
    if (probe.counting) {
      probe.work.push(performance.now() - frameStart);
    }
  };
  let last = 0;
  const tick = (now: number) => {
    if (probe.counting && last) {
      probe.gaps.push(now - last);
      frameStart = performance.now();
      channel.port2.postMessage(0);
    }
    last = now;
    native(tick);
  };
  native(tick);

  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    native((now) => {
      probe.appFrames += 1;
      callback(now);
    });

  new MutationObserver((records) => {
    probe.mutations += records.length;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const node = target?.closest('.svelte-flow__node, .react-flow__node');
      if (!node) {
        continue;
      }
      const id = node.getAttribute('data-id') ?? '?';
      probe.perNode[id] = (probe.perNode[id] ?? 0) + 1;
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
};

export async function measure(page: Page, ms: number, gesture: (until: number) => Promise<void>): Promise<Frames> {
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true }));
  await gesture(Date.now() + ms);
  const { gaps, work } = await page.evaluate(() => {
    const probe = (window as unknown as { __frames: { gaps: number[]; work: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return { gaps: [...probe.gaps].sort((a, b) => a - b), work: [...probe.work].sort((a, b) => a - b) };
  });
  const at = (list: number[], share: number) => list[Math.min(list.length - 1, Math.floor(list.length * share))] ?? 0;
  const mean = gaps.reduce((sum, g) => sum + g, 0) / Math.max(1, gaps.length);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    fpsAvg: Math.round(1000 / mean),
    fpsP5: Math.round(1000 / at(gaps, 0.95)),
    p50: round(at(gaps, 0.5)),
    p95: round(at(gaps, 0.95)),
    max: round(gaps.at(-1) ?? 0),
    over8: gaps.filter((g) => g > PRO_MOTION_MS + 0.5).length,
    over17: gaps.filter((g) => g > DISPLAY_MS + 1).length,
    over33: gaps.filter((g) => g > DROPPED_MS + 1).length,
    frames: gaps.length,
    workP95: round(at(work, 0.95))
  };
}

export async function wheelPan(page: Page, until: number) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  for (let i = 0; Date.now() < until; i++) {
    const t = i / 10;
    await page.mouse.wheel(Math.sin(t) * 120, Math.cos(t * 0.7) * 120);
  }
}

export async function dragPan(page: Page, until: number, from: { x: number; y: number }, button: 'left' | 'middle') {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  for (let i = 0; Date.now() < until; i++) {
    const t = i / 10;
    await page.mouse.move(from.x + Math.sin(t) * 200, from.y + Math.cos(t * 0.7) * 150);
  }
  await page.mouse.up({ button });
}

export async function wheelZoom(page: Page, until: number) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; Date.now() < until; i++) {
    await page.mouse.wheel(0, Math.floor(i / 8) % 2 ? 60 : -60);
  }
  await page.keyboard.up('Control');
}

export async function dragFrom(page: Page, from: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(from.x + i * 4, from.y + i * 2);
  }
  await page.mouse.up();
}
