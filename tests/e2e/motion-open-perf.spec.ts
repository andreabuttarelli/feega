import { writeFileSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONE_VIEWPORT = { width: 390, height: 844 };
const PHONE_CPU_SLOWDOWN = 4;
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const QUIET_MS = 1000;
const SETTLE_MS = 30_000;
const PHONE = { sessionKb: 64, mount: 400, picture: 1200 };
const DESKTOP = { sessionKb: 64, mount: 200, picture: 600 };
const PERF_OUT = process.env.MOTION_OPEN_PERF_OUT;
const BUILT = Boolean(process.env.E2E_BASE_URL);

test.use({ video: PERF_OUT ? 'on' : 'off' });

type Mark = 'tap' | 'selected' | 'loading' | 'chrome' | 'preview' | 'ready' | 'idle';
type Fetched = { name: string; start: number; end: number; kb: number };
type Timeline = { fetched?: Fetched[]; marks: Partial<Record<Mark, number>>; longTasks: { start: number; duration: number }[]; session?: { start: number; end: number; ttfb: number; bytes: number; decoded: number } };

function installProbe() {
  const t = { marks: {} as Record<string, number>, longTasks: [] as { start: number; duration: number }[] };
  (window as unknown as { __open: typeof t }).__open = t;
  const mark = (name: string) => {
    if (t.marks.tap !== undefined && t.marks[name] === undefined) {
      t.marks[name] = performance.now();
    }
  };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      t.longTasks.push({ start: e.startTime, duration: e.duration });
    }
  }).observe({ type: 'longtask', buffered: true });
  addEventListener(
    'pointerdown',
    (e) => {
      if ((e.target as Element).closest?.('.svelte-flow__node') && t.marks.tap === undefined) {
        t.marks.tap = e.timeStamp;
      }
    },
    true
  );
  addEventListener(
    'ready',
    (e) => {
      if ((e.target as Element).closest?.('[data-testid=editor-stage]')) {
        mark('ready');
      }
    },
    true
  );
  const scan = () => {
    if (document.querySelector('.svelte-flow__node.selected')) {
      mark('selected');
    }
    if (document.querySelector('[data-testid=inline-motion-loading]')) {
      mark('loading');
    }
    if (document.querySelector('[data-testid=motion-editor]')) {
      mark('chrome');
    }
    if (document.querySelector('[data-testid=editor-stage] [data-testid=motion-preview]')) {
      mark('preview');
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}

async function timeline(page: Page): Promise<Timeline> {
  return page.evaluate(() => {
    const t = (window as unknown as { __open: Timeline }).__open;
    const entry = performance.getEntriesByType('resource').find((e) => e.name.endsWith('/session')) as PerformanceResourceTiming | undefined;
    const session = entry ? { start: entry.startTime, end: entry.responseEnd, ttfb: entry.responseStart - entry.requestStart, bytes: entry.encodedBodySize, decoded: entry.decodedBodySize } : undefined;
    const tap = t.marks.tap ?? 0;
    const fetched = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((e) => e.startTime >= tap)
      .map((e) => ({ name: e.name.replace(location.origin, '').slice(0, 90), start: Math.round(e.startTime - tap), end: Math.round(e.responseEnd - tap), kb: Math.round(e.encodedBodySize / 1024) }));
    return { marks: t.marks, longTasks: t.longTasks, session, fetched };
  });
}

async function settle(page: Page) {
  await expect
    .poll(
      async () => {
        const { marks, longTasks } = await timeline(page);
        const last = Math.max(marks.ready ?? 0, ...longTasks.map((l) => l.start + l.duration));
        const now = await page.evaluate(() => performance.now());
        return marks.ready !== undefined && now - last > QUIET_MS;
      },
      { timeout: SETTLE_MS, intervals: [250] }
    )
    .toBe(true)
    .catch(() => undefined);
}

function phases(t: Timeline) {
  const tap = t.marks.tap ?? 0;
  const rel = (v?: number) => (v === undefined ? null : Math.round(v - tap));
  const after = t.longTasks.filter((l) => l.start >= tap);
  const interactive = Math.max(t.marks.ready ?? 0, ...after.map((l) => l.start + l.duration));
  return {
    selected: rel(t.marks.selected),
    loading: rel(t.marks.loading),
    sessionStart: rel(t.session?.start),
    sessionEnd: rel(t.session?.end),
    sessionTtfb: t.session ? Math.round(t.session.ttfb) : null,
    sessionKb: t.session ? Math.round(t.session.bytes / 1024) : null,
    sessionRawKb: t.session ? Math.round(t.session.decoded / 1024) : null,
    chrome: rel(t.marks.chrome),
    preview: rel(t.marks.preview),
    ready: rel(t.marks.ready),
    interactive: rel(interactive),
    longTaskMs: Math.round(after.reduce((s, l) => s + l.duration, 0)),
    longestTaskMs: Math.round(Math.max(0, ...after.map((l) => l.duration))),
    fetched: t.fetched ?? []
  };
}

type Phone = 'phone' | 'desktop';

type Budget = { sessionKb: number; mount: number; picture: number };

const DEVICES: Record<Phone, { use: Parameters<typeof test.use>[0]; budget: Budget; throttle: boolean }> = {
  phone: { use: { viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true }, budget: PHONE, throttle: true },
  desktop: { use: { viewport: { width: 1440, height: 900 } }, budget: DESKTOP, throttle: false }
};

for (const [name, device] of Object.entries(DEVICES) as [Phone, (typeof DEVICES)[Phone]][]) {
  test.describe(`opening a frame node on ${name} @real`, () => {
    test.skip(!REAL_STACK || !BUILT, 'budget su una build di produzione: E2E_REAL_STACK=1 E2E_BASE_URL=<vite preview>');
    test.use(device.use);
    test.setTimeout(180_000);

    test(`the editor mounts within ${device.budget.mount} ms of its ${device.budget.sessionKb} KB session and draws ${device.budget.picture} ms later`, async ({ page, session, admin, seedNode }, info) => {
      const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await page.addInitScript(installProbe);
      const cdp = await page.context().newCDPSession(page);
      const wire: { url: string; at: number; bytes?: number; cached?: boolean; done?: number }[] = [];
      const byId = new Map<string, (typeof wire)[number]>();
      await cdp.send('Network.enable');
      cdp.on('Network.requestWillBeSent', (e) => {
        const row = { url: e.request.url.slice(0, 100), at: e.timestamp };
        byId.set(e.requestId, row);
        wire.push(row);
      });
      cdp.on('Network.responseReceived', (e) => {
        const row = byId.get(e.requestId);
        if (row) {
          row.cached = e.response.fromDiskCache || e.response.fromServiceWorker;
        }
      });
      cdp.on('Network.loadingFinished', (e) => {
        const row = byId.get(e.requestId);
        if (row) {
          row.bytes = e.encodedDataLength;
          row.done = e.timestamp;
        }
      });
      if (device.throttle) {
        await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
      }
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      if (device.throttle) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: PHONE_CPU_SLOWDOWN });
      }

      const stage = page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage');
      await expect(stage).toBeVisible();
      if (device.throttle) {
        await stage.tap({ position: { x: 60, y: 10 } });
      } else {
        await stage.click({ position: { x: 60, y: 10 } });
      }
      await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 60_000 });
      await settle(page);

      const result = phases(await timeline(page));
      info.annotations.push({ type: 'phases', description: JSON.stringify(result) });
      if (PERF_OUT) {
        writeFileSync(`${PERF_OUT}/${name}-${Date.now()}.json`, JSON.stringify(result, null, 2));
        writeFileSync(`${PERF_OUT}/${name}-wire-${Date.now()}.json`, JSON.stringify(wire, null, 1));
      }
      const facts = JSON.stringify(result);
      expect(result.sessionRawKb, facts).toBeLessThan(device.budget.sessionKb);
      expect(result.chrome! - result.sessionEnd!, facts).toBeLessThan(device.budget.mount);
      expect(result.ready! - result.chrome!, facts).toBeLessThan(device.budget.picture);
    });
  });
}
