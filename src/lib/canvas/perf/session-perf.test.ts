import { describe, expect, it } from 'vitest';
import { Camera, Gesture, Histogram, LoadStep, gestureOf, sessionPerf, type Context } from './session-perf';

const CONTEXT: Context = { sessionId: 's1', canvasId: 'c1', device: 'desktop', dpr: 2, cores: 8, memoryGb: 8, coreVersion: 'abc', frames: 3, nodes: 12, docBytes: 4096, heapMb: null };

function framesAt(perf: ReturnType<typeof sessionPerf>, kind: Gesture, start: number, deltas: number[]) {
  let at = start;
  perf.frame(kind, at);
  for (const d of deltas) {
    at += d;
    perf.frame(kind, at);
  }
  return at;
}

describe('Histogram', () => {
  it('reads percentiles at bucket resolution', () => {
    const h = new Histogram(1, 200);
    for (let i = 1; i <= 100; i++) {
      h.add(i);
    }

    expect(h.count).toBe(100);
    expect(h.quantile(0.5)).toBe(50);
    expect(h.quantile(0.95)).toBe(95);
  });

  it('clamps values past the last bucket into it', () => {
    const h = new Histogram(10, 100);
    h.add(5000);

    expect(h.quantile(0.99)).toBe(100);
  });

  it('an empty histogram has no percentile', () => {
    expect(new Histogram(1, 10).quantile(0.5)).toBeNull();
  });
});

describe('sessionPerf', () => {
  it('counts gesture frames by kind, with the share over budget and the tail', () => {
    const perf = sessionPerf();
    framesAt(perf, Gesture.Pan, 0, [8, 8, 8, 20]);
    perf.frame(null, 1000);
    framesAt(perf, Gesture.Zoom, 2000, [16]);

    const s = perf.summary(CONTEXT, 3000);

    expect(s.gestures.pan).toMatchObject({ frames: 4, over: 0.25, p95: 20, p99: 20 });
    expect(s.gestures.zoom).toMatchObject({ frames: 1, over: 1 });
    expect(s.gestures.fit).toBeUndefined();
  });

  it('a pause between two gestures is not a frame', () => {
    const perf = sessionPerf();
    framesAt(perf, Gesture.Pan, 0, [8]);
    perf.frame(null, 50);
    framesAt(perf, Gesture.Pan, 5000, [8]);

    expect(perf.summary(CONTEXT, 6000).gestures.pan?.frames).toBe(2);
  });

  it('ignores a delta of a hidden tab', () => {
    const perf = sessionPerf();
    framesAt(perf, Gesture.Drag, 0, [8, 4000]);

    expect(perf.summary(CONTEXT, 5000).gestures.drag?.frames).toBe(1);
  });

  it('charges a long task to the gesture under way, and to the session', () => {
    const perf = sessionPerf();
    perf.frame(Gesture.Fit, 0);
    perf.longTask(80);
    perf.frame(null, 100);
    perf.longTask(60);

    const s = perf.summary(CONTEXT, 200);

    expect(s.gestures.fit?.longTasks).toBe(1);
    expect(s.longTasks).toEqual({ count: 2, ms: 140 });
  });

  it('reports edit latency p50 and p95', () => {
    const perf = sessionPerf();
    [10, 20, 30, 40, 400].forEach((ms) => perf.edit(ms));

    expect(perf.summary(CONTEXT, 0).edit).toEqual({ n: 5, p50: 30, p95: 400 });
  });

  it('keeps the backend, its fallbacks and device losses', () => {
    const perf = sessionPerf();
    perf.backend('webgpu');
    perf.deviceLost();
    perf.backend('webgl');

    expect(perf.summary(CONTEXT, 0)).toMatchObject({ backend: 'webgl', fallbacks: 1, deviceLost: 1 });
  });

  it('a load step is kept once, the first time', () => {
    const perf = sessionPerf();
    perf.load(LoadStep.FirstContent, 300.4);
    perf.load(LoadStep.FirstContent, 900);
    perf.load(LoadStep.Sharp, 1200);

    expect(perf.summary(CONTEXT, 0).load).toEqual({ firstContent: 300, allFrames: null, sharp: 1200 });
  });

  it('carries only ids and numbers from the context', () => {
    const s = perf0();

    expect(s).toMatchObject({ v: 1, sessionId: 's1', canvasId: 'c1', device: 'desktop', dpr: 2, cores: 8, memoryGb: 8, coreVersion: 'abc', frames: 3, nodes: 12, docBytes: 4096, heapMb: null, sessionMs: 10 });
  });
});

function perf0() {
  return sessionPerf().summary(CONTEXT, 10);
}

describe('gestureOf', () => {
  it('names the gesture under way, or none', () => {
    expect(gestureOf({ lifting: true, camera: Camera.Still, fitting: false })).toBe(Gesture.Drag);
    expect(gestureOf({ lifting: false, camera: Camera.Zooming, fitting: true })).toBe(Gesture.Fit);
    expect(gestureOf({ lifting: false, camera: Camera.Zooming, fitting: false })).toBe(Gesture.Zoom);
    expect(gestureOf({ lifting: false, camera: Camera.Panning, fitting: false })).toBe(Gesture.Pan);
    expect(gestureOf({ lifting: false, camera: Camera.Still, fitting: true })).toBeNull();
  });
});
