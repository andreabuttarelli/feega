import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest';
import type { Selection } from './protocol';
import { holds, isCondition } from './when';

const pick = (attributes: { name: string; value: string }[] = [], styles: Record<string, string> = {}): Selection => ({ source: { file: 'a', line: 1, col: 1 }, component: null, tag: 'div', name: 'div', classes: '', rect: { x: 0, y: 0, width: 1, height: 1 }, styles, attributes });

describe('holds', () => {
  it('holds without conditions, even without a selection', () => {
    expect(holds(undefined, null)).toBe(true);
    expect(holds([], null)).toBe(true);
  });

  it('needs a selection for "selection"', () => {
    expect(holds(['selection'], null)).toBe(false);
    expect(holds(['selection'], pick())).toBe(true);
  });

  it('checks attributes on the selected element', () => {
    const scene = pick([{ name: 'data-feega-scene', value: 'cube' }]);
    expect(holds(['attribute:data-feega-scene'], scene)).toBe(true);
    expect(holds(['attribute:data-feega-scene'], pick())).toBe(false);
    expect(holds(['!attribute:data-feega-scene'], scene)).toBe(false);
    expect(holds(['!attribute:data-feega-scene'], pick())).toBe(true);
  });

  it('needs every condition', () => {
    expect(holds(['selection', '!attribute:x'], pick([{ name: 'x', value: '' }]))).toBe(false);
    expect(holds(['selection', '!attribute:x'], pick())).toBe(true);
  });

  it('negative attribute conditions hold with no selection', () => {
    expect(holds(['!attribute:x'], null)).toBe(true);
  });
});

describe('owned', () => {
  const OWNS = ['attribute:data-feega-scene'];
  const scene = pick([{ name: 'data-feega-scene', value: 'cube' }]);

  it('holds only when the selection matches what the plugin owns', () => {
    expect(holds(['selection', 'owned'], scene, OWNS)).toBe(true);
    expect(holds(['selection', 'owned'], pick(), OWNS)).toBe(false);
    expect(holds(['owned'], null, OWNS)).toBe(false);
  });

  it('never holds for a plugin that owns nothing', () => {
    expect(holds(['owned'], scene)).toBe(false);
    expect(holds(['owned'], scene, [])).toBe(false);
  });

  it('matches a style value by the text it contains', () => {
    const owns = ['style:background-image*=radial-gradient'];

    expect(holds(['owned'], pick([], { 'background-image': 'radial-gradient(at 10% 10%, #fff, transparent)' }), owns)).toBe(true);
    expect(holds(['owned'], pick([], { 'background-image': 'none' }), owns)).toBe(false);
    expect(holds(['owned'], pick(), owns)).toBe(false);
  });
});

describe('isCondition', () => {
  it.each([['selection', true], ['attribute:a', true], ['!attribute:a', true], ['attribute:', false], ['sometimes', false], ['!selection', false], ['owned', true], ['style:background-image*=gradient(', true], ['style:*=x', false]])('%s -> %s', (text, ok) => {
    expect(isCondition(text)).toBe(ok);
  });
});

describe('manifest when', () => {
  const base = { id: 'a', name: 'A', version: '1.0.0' };

  it('keeps the conditions of a contribution', () => {
    const out = parseManifest({ ...base, contributions: { rightBar: [{ id: 'x', title: 'X', when: ['!attribute:data-feega-scene'] }] } });
    expect(out.ok && out.manifest.contributions.rightBar?.[0].when).toEqual(['!attribute:data-feega-scene']);
  });

  it('keeps what the plugin owns and refuses unknown rules in it', () => {
    const ok = parseManifest({ ...base, owns: ['attribute:data-x'], contributions: {} });
    const bad = parseManifest({ ...base, owns: ['whenever'], contributions: {} });

    expect(ok.ok && ok.manifest.owns).toEqual(['attribute:data-x']);
    expect(bad.ok).toBe(false);
  });

  it('refuses an unknown condition', () => {
    const out = parseManifest({ ...base, contributions: { rightBar: [{ id: 'x', title: 'X', when: ['whenever'] }] } });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toMatch(/when/);
  });
});
