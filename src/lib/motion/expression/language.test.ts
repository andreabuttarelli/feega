import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { MAX_SOURCE, SILENT_AUDIO, compileExpression, runExpression, type Scope } from './language';
import { InputKey, fallbackPort, valuesPort } from './inputs';

const scope = (extra: Partial<Scope> = {}): Scope => ({
  time: 1,
  frame: 30,
  fps: 30,
  value: 10,
  index: 1,
  seed: 7,
  track: [],
  thisLayer: { get: () => 0 },
  layer: () => ({ get: () => 0 }),
  audio: SILENT_AUDIO,
  input: fallbackPort(1),
  ...extra
});

function run(source: string, extra: Partial<Scope> = {}): number {
  const compiled = compileExpression(source);
  if (!compiled.ok) {
    throw new Error(compiled.error);
  }
  return runExpression(compiled.program, scope(extra));
}

function error(source: string, extra: Partial<Scope> = {}): string {
  const compiled = compileExpression(source);
  if (!compiled.ok) {
    return compiled.error;
  }
  try {
    runExpression(compiled.program, scope(extra));
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

describe('expression language', () => {
  it('reads value, time and frame and does arithmetic with precedence', () => {
    expect(run('value + time * 360')).toBe(370);
    expect(run('(value + 2) * 2 ** 2 % 7')).toBe(6);
    expect(run('frame > 20 ? -value : value')).toBe(-10);
  });

  it('keeps declarations and returns the last expression', () => {
    expect(run('const a = 3; let b = a * 2\nb + value')).toBe(16);
  });

  it('exposes a Math subset and degree helpers', () => {
    expect(run('Math.max(1, Math.abs(-4), Math.PI > 3 ? 2 : 0)')).toBe(4);
    expect(run('degreesToRadians(180)')).toBeCloseTo(Math.PI);
    expect(run('clamp(value, 0, 5)')).toBe(5);
  });

  it('maps ranges with linear and ease, in five and three argument forms', () => {
    expect(run('linear(time, 0, 2, 0, 100)')).toBe(50);
    expect(run('linear(5, 0, 2, 0, 100)')).toBe(100);
    expect(run('linear(0.25, 0, 100)')).toBe(25);
    expect(run('ease(time, 0, 2, 0, 100)')).toBe(50);
    expect(run('easeIn(time, 0, 2, 0, 100)')).toBeLessThan(50);
    expect(run('easeOut(time, 0, 2, 0, 100)')).toBeGreaterThan(50);
  });

  it('wiggle is deterministic, seeded, bounded and moves with time', () => {
    const at = (time: number, seed = 7) => run('wiggle(3, 20)', { time, seed });
    expect(at(1.3)).toBe(at(1.3));
    expect(at(1.3)).not.toBe(at(1.3, 8));
    expect(at(1.3)).not.toBe(at(1.7));
    expect(run('wiggle(3, 20, 1, 42)', { time: 0.5 })).toBe(run('wiggle(3, 20, 1, 42)', { time: 0.5, seed: 99 }));
    for (let t = 0; t < 5; t += 0.1) {
      expect(Math.abs(at(t) - 10)).toBeLessThanOrEqual(20 * 2);
    }
  });

  it('random is deterministic per seed and spans a range', () => {
    expect(run('random(3)')).toBe(run('random(3)'));
    expect(run('random(3)')).not.toBe(run('random(4)'));
    const r = run('random(5, 10, 20)');
    expect(r).toBeGreaterThanOrEqual(10);
    expect(r).toBeLessThan(20);
  });

  it('loops keyframes after the last key and before the first', () => {
    const track = [
      { frame: 0, value: 0, ease: Ease.Linear },
      { frame: 30, value: 100, ease: Ease.Linear }
    ];
    expect(run('loopOut()', { track, frame: 45, time: 1.5 })).toBe(50);
    expect(run('loopOut("pingpong")', { track, frame: 45, time: 1.5 })).toBe(50);
    expect(run('loopOut("pingpong")', { track, frame: 40, time: 40 / 30 })).toBeCloseTo(100 - (10 / 30) * 100);
    expect(run('loopOut("offset")', { track, frame: 45, time: 1.5 })).toBe(150);
    expect(run('loopOut("continue")', { track, frame: 45, time: 1.5 })).toBeCloseTo(150);
    expect(run('loopOut()', { track, frame: 15, time: 0.5, value: 50 })).toBe(50);
    const late = track.map((k) => ({ ...k, frame: k.frame + 30 }));
    expect(run('loopIn()', { track: late, frame: 15, time: 0.5 })).toBe(50);
  });

  it('reads another layer through a handle', () => {
    const layer = (ref: string | number) => ({ get: (key: string) => (ref === 'logo' && key === 'x' ? 0.25 : 0) });
    expect(run('layer("logo").x + thisLayer.x', { layer, thisLayer: { get: () => 1 } })).toBe(1.25);
  });

  it('has no globals, no prototypes and no way out of the sandbox', () => {
    expect(error('globalThis')).toContain('unknown name');
    expect(error('window.alert(1)')).toContain('unknown name');
    expect(error('Math.constructor')).toContain('constructor');
    expect(error('Math["constructor"]("return 1")')).toContain('constructor');
    expect(error('"abc".length')).toContain('length');
    expect(error('[1,2].__proto__')).toContain('__proto__');
    expect(error('value()')).toContain('not a function');
    expect(error('x = 3')).not.toBe('');
    expect(error('function f(){}')).not.toBe('');
    expect(error('for(;;){}')).not.toBe('');
    expect(error('while(true){}')).not.toBe('');
    expect(error('import("x")')).not.toBe('');
    expect(error('`template`')).not.toBe('');
  });

  it('refuses a non-number result and oversize or runaway programs', () => {
    expect(error('"text"')).toContain('number');
    expect(error('0/0')).toContain('number');
    expect(error('x'.repeat(MAX_SOURCE + 1))).toContain('long');
    expect(error('('.repeat(500) + '1' + ')'.repeat(500))).toContain('deep');
    const sum = Array.from({ length: 140 }, () => 'wiggle(1,1,8)').join('+');
    expect(error(sum)).toContain('too much work');
  });

  it('keeps arrays for index access', () => {
    expect(run('[3, value, 5][1] + [1, 2].length')).toBe(12);
  });
});

describe('audio', () => {
  const audio = {
    amp: (ref: string | number | null, smoothing: number) => (ref === 'vo' ? 0.2 : 0.5 + smoothing / 100),
    beat: () => 1,
    onset: () => 0.25
  };

  it('audio.amp reads the music, or the clip or track named, smoothed over frames', () => {
    expect(run('audio.amp()', { audio })).toBe(0.51);
    expect(run('audio.amp("vo")', { audio })).toBe(0.2);
    expect(run('audio.amp("music", 10)', { audio })).toBe(0.6);
  });

  it('audio.beat and audio.onset pulse with the hits', () => {
    expect(run('value * (1 + audio.beat())', { audio })).toBe(20);
    expect(run('audio.onset()', { audio })).toBe(0.25);
  });

  it('without analysed audio everything is silent', () => {
    expect(run('audio.amp() + audio.beat() + audio.onset()')).toBe(0);
  });

  it('amp takes a name or an index and a number', () => {
    expect(error('audio.amp([1])')).toMatch(/audio.amp/);
  });

  it('reads every live input at its default when nothing is connected', () => {
    expect(run('input.pointer.x + input.pointer.y')).toBe(1);
    expect(run('input.pointer.down + input.hover + input.tilt.x + input.tilt.y + input.scroll')).toBe(0);
    expect(run('input.time')).toBe(1);
  });

  it('reads simulated inputs and leaves missing ones at their default', () => {
    const input = valuesPort({ [InputKey.PointerX]: 0.9, [InputKey.TiltY]: -0.5, [InputKey.Scroll]: 0.25 }, 2, (_s, t) => t);

    expect(run('(input.pointer.x - 0.5) * 100', { input })).toBeCloseTo(40);
    expect(run('input.tilt.y * 20 + input.scroll', { input })).toBeCloseTo(-9.75);
    expect(run('input.pointer.y + input.time', { input })).toBe(2.5);
  });

  it('smooths through the port, one slot per call in reading order', () => {
    const calls: [number, number, number][] = [];
    const input = valuesPort({}, 0, (slot, target, seconds) => {
      calls.push([slot, target, seconds]);
      return target / 2;
    });

    expect(run('input.smooth(input.pointer.x, 0.15) + input.smooth(4, 0.3)', { input })).toBe(2.25);
    expect(calls).toEqual([
      [0, 0.5, 0.15],
      [1, 4, 0.3]
    ]);
  });

  it('refuses an input that does not exist', () => {
    expect(error('input.mouse')).toContain('unknown member "mouse"');
  });
});

