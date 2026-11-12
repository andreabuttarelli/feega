import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Beacon, startCanvasPerf, type PerfPlace } from './perf-beacon';

const sent: Blob[] = [];
let doc: EventTarget & { visibilityState: string };

beforeEach(() => {
  sent.length = 0;
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { hardwareConcurrency: 6, sendBeacon: (_url: string, body: Blob) => (sent.push(body), true) });
});

afterEach(() => vi.unstubAllGlobals());

const MEMORY = { textureMb: 140, textures: 300, wasmMb: 96, cacheMb: 40, pictureMb: 20 };

const place = (over: Partial<PerfPlace> = {}): PerfPlace => ({
  canvasId: 'c1',
  device: 'phone',
  platform: 'iphone',
  dpr: 3,
  frames: () => 22,
  area: () => ({ width: 393, height: 852 }),
  memory: () => MEMORY,
  diedBefore: false,
  before: null,
  ...over
});

const lastBody = async () => JSON.parse(await sent[sent.length - 1].text()) as Record<string, unknown>;
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the canvas perf beacon', () => {
  it('sends the moment the engine is up, not five minutes later', async () => {
    const perf = startCanvasPerf(place(), () => 0);

    perf.backend('webgl');
    await settle();

    expect(await lastBody()).toMatchObject({ reason: Beacon.Start, backend: 'webgl', platform: 'iphone', width: 393, height: 852, memory: MEMORY, visible: 1 });
    perf.stop();
  });

  it('carries the last engine error when the page goes away', async () => {
    const perf = startCanvasPerf(place(), () => 0);

    perf.error('device lost');
    window.dispatchEvent(new Event('pagehide'));

    expect(await lastBody()).toMatchObject({ reason: Beacon.PageHide, lastError: 'device lost' });
    perf.stop();
  });

  it('remembers an uncaught error as the last error', async () => {
    const perf = startCanvasPerf(place(), () => 0);

    window.dispatchEvent(Object.assign(new Event('error'), { message: 'RuntimeError: unreachable' }));
    perf.stop();

    expect(await lastBody()).toMatchObject({ lastError: 'RuntimeError: unreachable' });
  });

  it('tells that the session before it died, and what it held', async () => {
    const before = { ...MEMORY, textureMb: 610, zoom: 0.2, gestureFrames: 9 };
    const perf = startCanvasPerf(place({ diedBefore: true, before }), () => 0);

    perf.stop();

    expect(await lastBody()).toMatchObject({ diedBefore: 1, before });
  });

  it('marks a beacon from a tab that is not on screen', async () => {
    doc.visibilityState = 'hidden';
    const perf = startCanvasPerf(place({ area: () => ({ width: 0, height: 0 }) }), () => 0);

    perf.stop();

    expect(await lastBody()).toMatchObject({ visible: 0, width: 0, height: 0, backend: null });
  });
});
