import { describe, expect, it } from 'vitest';
import { OffScreenRead, readSight } from './read-sight';

describe('readSight', () => {
  it('un frame fuori schermo non monta la lettura del DOM e aspetta di entrare in vista', () => {
    const gate = readSight();

    expect(() => gate.hold('a', new Set())).toThrow(OffScreenRead);
    expect(gate.admits('a', new Set())).toBe(false);
    expect(gate.admits('a', new Set(['a']))).toBe(true);
  });

  it('un frame in vista legge subito', () => {
    const gate = readSight();

    expect(() => gate.hold('a', new Set(['a']))).not.toThrow();
    expect(gate.admits('a', new Set())).toBe(true);
  });

  it('un frame mai trattenuto si costruisce anche fuori schermo', () => {
    expect(readSight().admits('b', new Set())).toBe(true);
  });
});
