import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CDPSession, Locator, Page } from '@playwright/test';
import { easeInOutExpo, type DemoEvent, type Point, type Rect } from './camera';
import { CURSOR_SCRIPT } from './cursor';

export type Recording = { dir: string; view: { width: number; height: number }; frames: { file: string; t: number }[]; events: DemoEvent[]; duration: number };

const FRAME_QUALITY = 92;
const MOVE_HZ = 60;
const MIN_MOVE_MS = 450;
const MAX_MOVE_MS = 1100;
const MS_PER_PX = 0.9;
const TYPE_DELAY_MS = 75;
const BEAT_MS = 700;
const PRESS_MS = 90;
const BADGE_LEAD_MS = 250;
const LOCATE_MS = 15_000;

type ScreencastFrame = { data: string; sessionId: number; metadata: { timestamp?: number } };

export async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(CURSOR_SCRIPT);
}

export async function demo(page: Page, dir: string) {
  mkdirSync(dir, { recursive: true });
  const view = page.viewportSize()!;
  const events: DemoEvent[] = [];
  const frames: Recording['frames'] = [];
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const scale = await page.evaluate(() => window.devicePixelRatio);
  let origin = 0;
  let mouse: Point = { x: view.width / 2, y: view.height / 2 };

  const now = () => (Date.now() - origin) / 1000;

  cdp.on('Page.screencastFrame', (frame: ScreencastFrame) => {
    const t = (frame.metadata.timestamp ?? Date.now() / 1000) - origin / 1000;
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(frame.data, 'base64'));
    frames.push({ file, t });
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });

  async function moveTo(to: Point) {
    const from = mouse;
    const ms = Math.min(MAX_MOVE_MS, Math.max(MIN_MOVE_MS, Math.hypot(to.x - from.x, to.y - from.y) * MS_PER_PX));
    const steps = Math.round((ms / 1000) * MOVE_HZ);
    for (let i = 1; i <= steps; i++) {
      const p = easeInOutExpo(i / steps);
      await page.mouse.move(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p);
      await page.waitForTimeout(1000 / MOVE_HZ);
    }
    mouse = to;
  }

  async function centreOf(target: Locator | Point): Promise<Point> {
    if ('x' in target) {
      return target;
    }
    await target.waitFor({ state: 'visible', timeout: LOCATE_MS });
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async function press(at: Point, options: { button?: 'left' | 'right'; clickCount?: number } = {}) {
    events.push({ kind: 'click', t: now(), x: at.x, y: at.y });
    if (options.clickCount === 2) {
      await page.mouse.dblclick(at.x, at.y, { button: options.button });
      return;
    }
    await page.mouse.down({ button: options.button });
    await page.waitForTimeout(PRESS_MS);
    await page.mouse.up({ button: options.button });
  }

  return {
    async start() {
      await page.mouse.move(mouse.x, mouse.y);
      origin = Date.now();
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: FRAME_QUALITY, maxWidth: Math.round(view.width * scale), maxHeight: Math.round(view.height * scale), everyNthFrame: 1 });
      await page.waitForTimeout(BEAT_MS);
    },

    move: async (target: Locator | Point) => moveTo(await centreOf(target)),

    async click(target: Locator | Point, options: { button?: 'left' | 'right'; double?: boolean } = {}) {
      const at = await centreOf(target);
      await moveTo(at);
      await press(at, { button: options.button, clickCount: options.double ? 2 : 1 });
      await page.waitForTimeout(BEAT_MS);
    },

    async select(target: Locator, option: string) {
      const at = await centreOf(target);
      await moveTo(at);
      events.push({ kind: 'click', t: now(), x: at.x, y: at.y });
      await target.selectOption(option);
      await page.waitForTimeout(BEAT_MS);
    },

    async type(target: Locator | null, text: string, options: { click?: boolean } = {}) {
      if (target && options.click !== false) {
        await moveTo(await centreOf(target));
        await press(mouse);
        events.pop();
      }
      const field = target ?? page.locator(':focus');
      const rect: Rect = (await field.boundingBox()) ?? { x: mouse.x - 150, y: mouse.y - 20, width: 300, height: 40 };
      const t = now();
      await page.waitForTimeout(BEAT_MS);
      await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
      const grown = (await field.boundingBox().catch(() => null)) ?? rect;
      const union = { x: Math.min(rect.x, grown.x), y: Math.min(rect.y, grown.y), width: Math.max(rect.x + rect.width, grown.x + grown.width) - Math.min(rect.x, grown.x), height: Math.max(rect.y + rect.height, grown.y + grown.height) - Math.min(rect.y, grown.y) };
      events.push({ kind: 'type', t, end: now(), rect: union });
      await page.waitForTimeout(BEAT_MS);
    },

    async drag(from: Locator | Point, to: Locator | Point, path?: (p: number) => Point, fit?: Rect) {
      const a = await centreOf(from);
      const b = await centreOf(to);
      await moveTo(a);
      const t = now();
      await page.mouse.down();
      const steps = Math.round(MOVE_HZ * 1.2);
      for (let i = 1; i <= steps; i++) {
        const p = easeInOutExpo(i / steps);
        const at = path ? path(p) : { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
        await page.mouse.move(at.x, at.y);
        await page.waitForTimeout(1000 / MOVE_HZ);
        mouse = at;
      }
      await page.mouse.up();
      events.push({ kind: 'drag', t, end: now(), from: a, to: mouse, fit });
      await page.waitForTimeout(BEAT_MS);
    },

    async key(combo: string, badge?: string) {
      if (badge) {
        await page.evaluate((label) => (window as unknown as { demoBadge: (l: string) => void }).demoBadge(label), badge);
        await page.waitForTimeout(BADGE_LEAD_MS);
      }
      await page.keyboard.press(combo);
      await page.waitForTimeout(BEAT_MS);
    },

    wait: (ms: number) => page.waitForTimeout(ms),

    async finish(): Promise<Recording> {
      await page.waitForTimeout(BEAT_MS);
      await cdp.send('Page.stopScreencast');
      const recording: Recording = { dir, view, frames, events, duration: now() };
      writeFileSync(join(dir, 'recording.json'), JSON.stringify(recording, null, 1));
      return recording;
    }
  };
}

export type Demo = Awaited<ReturnType<typeof demo>>;
