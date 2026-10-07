import { describe, expect, it } from 'vitest';
import { creditsOfCost, estimatedUsage, HOLD_BUFFER, IDLE, RenderClass, renderClass, renderCostUsd, renderQuote, Resolution, RENDER_MULTIPLIER, sandboxCostUsd, type WorkerUsage } from './render-quote';
import { MULTIPLIER_FLOOR } from '$lib/credit-ladder';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';

function doc(frames: number, component?: string, props: Record<string, unknown> = {}): MotionDoc {
  const base = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: frames };
  if (!component) {
    return base;
  }
  const added = addClip(base, { component: component as never, from: 0, durationInFrames: frames, props }, 'x');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return { ...added.doc, durationInFrames: frames };
}

const blurred = (d: MotionDoc, samples: number): MotionDoc => ({ ...d, motionBlur: { enabled: true, shutterAngle: 180, shutterPhase: -90, samples } });

function masking(): MotionDoc {
  let d = doc(270);
  for (const id of ['a', 'b', 'c']) {
    const added = addClip(d, { component: 'Shape', from: 0, durationInFrames: 270 }, id);
    if (!added.ok) {
      throw new Error(added.error);
    }
    d = { ...added.doc, durationInFrames: 270 };
  }
  const heavy = { effects: ['stroke', 'drop-shadow'].map((kind, i) => ({ id: `e${i}`, kind, enabled: true, params: {} })), matte: 'alpha' };
  return blurred({ ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, ...heavy })) })) } as MotionDoc, 6);
}

const asRunInProduction = (bench: WorkerUsage): WorkerUsage => ({ ...bench, wallMs: bench.wallMs + IDLE.pieceMs + IDLE.headMs });

type Bench = { name: string; doc: MotionDoc; resolution: Resolution; usage: WorkerUsage };

const BENCH_2026_10_06_ONE_VCPU: Bench[] = [
  { name: '2D, 350 frames 1080p', doc: doc(350), resolution: Resolution.P1080, usage: { cpuMs: 23_064, memoryMb: 2048, wallMs: 18_917 } },
  { name: '4K, 350 frames', doc: doc(350), resolution: Resolution.P2160, usage: { cpuMs: 42_672, memoryMb: 2048, wallMs: 48_273 } },
  { name: 'motion blur ×4, 350 frames 1080p', doc: blurred(doc(350), 4), resolution: Resolution.P1080, usage: { cpuMs: 51_587, memoryMb: 2048, wallMs: 43_578 } },
  { name: 'masking loop: vector mattes, strokes, shadows, liquid shapes, blur ×6, 270 frames 1080p on 27 workers, mean of two runs', doc: masking(), resolution: Resolution.P1080, usage: { cpuMs: 4_651_000, memoryMb: 2048 * 27, wallMs: 172_340 } }
];

const BENCH_2026_10_05: Bench[] = [
  { name: '3D text, 120 frames 1080p', doc: doc(120, 'Text3D'), resolution: Resolution.P1080, usage: { cpuMs: 217_071, memoryMb: 8192, wallMs: 58_405 } },
  { name: 'Device3D laptop, 120 frames 1080p', doc: doc(120, 'Device3D', { device: 'laptop-pro' }), resolution: Resolution.P1080, usage: { cpuMs: 552_320, memoryMb: 8192, wallMs: 146_712 } }
];

describe('the render estimate', () => {
  it.each([...BENCH_2026_10_06_ONE_VCPU, ...BENCH_2026_10_05])('$name: within ±50% of what the sandbox measured', ({ doc, resolution, usage }) => {
    const measured = sandboxCostUsd([asRunInProduction(usage)]);

    expect(renderCostUsd(doc, resolution) / measured).toBeGreaterThan(0.5);
    expect(renderCostUsd(doc, resolution) / measured).toBeLessThan(1.5);
  });

  it('a chunk is billed for the memory of the worker its class opens: 2 GB per vCPU', () => {
    expect(estimatedUsage(doc(30)).map((u) => u.memoryMb)).toEqual([2048]);
    expect(estimatedUsage(doc(30, 'Text3D')).map((u) => u.memoryMb)).toEqual([8192]);
  });

  it('a doc is as heavy as its heaviest layer', () => {
    expect(renderClass(doc(30))).toBe(RenderClass.Flat);
    expect(renderClass(doc(30, 'Shape3D'))).toBe(RenderClass.Scene3D);
    expect(renderClass(doc(30, 'Device3D'))).toBe(RenderClass.Device3D);
  });
});

describe('the sandbox bill', () => {
  it('memory is billed at least a minute per sandbox, CPU only while it works', () => {
    const second = sandboxCostUsd([{ cpuMs: 0, memoryMb: 8192, wallMs: 1000 }]);

    expect(second).toBeCloseTo(sandboxCostUsd([{ cpuMs: 0, memoryMb: 8192, wallMs: 60_000 }]));
    expect(sandboxCostUsd([{ cpuMs: 3_600_000, memoryMb: 0, wallMs: 0 }])).toBeCloseTo(0.128);
  });
});

describe('render quote', () => {
  it('the multiplier on our cost never drops under the floor', () => {
    expect(RENDER_MULTIPLIER).toBeGreaterThanOrEqual(MULTIPLIER_FLOOR);
  });

  it('the price is the estimated cost times the multiplier, in credits, rounded up', () => {
    const d = doc(900);

    expect(renderQuote(d).credits).toBe(creditsOfCost(renderCostUsd(d)));
    expect(HOLD_BUFFER).toBeGreaterThan(1);
  });

  it('heavier content costs more: 3D over 2D, Device3D over 3D, 4K over 1080p, blur over none', () => {
    const flat = renderCostUsd(doc(300));

    expect(renderCostUsd(doc(300, 'Text3D'))).toBeGreaterThan(flat);
    expect(renderCostUsd(doc(300, 'Device3D'))).toBeGreaterThan(renderCostUsd(doc(300, 'Text3D')));
    expect(renderCostUsd(doc(300), Resolution.P2160)).toBeGreaterThan(flat);
    expect(renderCostUsd(blurred(doc(300), 4))).toBeGreaterThan(flat);
  });
});
