import { ENGINE_GLOBAL, engineScript, motionEngine, type MotionEngine } from './engine';

export type TestTimeline = Record<string, (...args: unknown[]) => unknown>;

export function installEngine(): MotionEngine {
  if (typeof window === 'undefined') {
    return motionEngine({} as Window & Record<string, unknown>);
  }
  window.eval(engineScript());
  return (window as unknown as Record<string, MotionEngine>)[ENGINE_GLOBAL];
}

export function testTimeline(engine: MotionEngine): TestTimeline {
  return engine.timeline() as unknown as TestTimeline;
}
