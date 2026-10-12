import { describe, expect, it } from 'vitest';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { SFX_LIBRARY, Sfx, cursorCues } from './sfx';
import { CursorAction, cursorMath } from './shots/cursor';

const MAX_BYTES = 30_000;
const UI = { width: 1280, height: 800, box: (id: string) => ({ 'input-0': { x: 400, y: 300, w: 600, h: 60, role: 'input' }, 'button-0': { x: 1050, y: 370, w: 40, h: 40, role: 'button' } })[id] ?? null };

describe('the built-in sound effects', () => {
  it.each(Object.values(SFX_LIBRARY).map((s) => [s.sfx, s] as const))('%s is a bundled CC0 file under 30 KB', (_, sound) => {
    expect(sound.license).toBe('CC0-1.0');
    expect(statSync(resolve(import.meta.dirname, 'sfx', sound.file)).size).toBeLessThan(MAX_BYTES);
  });
});

describe('cursor cues', () => {
  const plan = cursorMath().plan([{ target: 'input-0', action: CursorAction.Type, text: 'hello' }, { target: 'button-0', action: CursorAction.Click }, { target: 'button-0', action: CursorAction.Hover }], UI, 4);

  it('clicks on every click, and on the field before typing', () => {
    const clicks = cursorCues(plan.steps).filter((c) => c.sfx === Sfx.Click).map((c) => c.at);

    expect(clicks).toEqual([plan.steps[0].at, plan.steps[1].at]);
  });

  it('taps a key as each character appears', () => {
    const keys = cursorCues(plan.steps).filter((c) => c.sfx === Sfx.Key).map((c) => c.at);

    expect(keys).toHaveLength('hello'.length);
    expect(keys[0]).toBeGreaterThan(plan.steps[0].at);
    expect(keys[keys.length - 1]).toBeLessThanOrEqual(plan.steps[0].end);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
  });

  it('puts no sound on a hover', () => {
    expect(cursorCues([plan.steps[2]])).toEqual([]);
  });
});
