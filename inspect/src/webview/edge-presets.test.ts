import { describe, expect, it } from 'vitest';
import type { Controls } from './canvas-card';
import { EDGE_LONG_TEXT_LENGTH, EdgePreset, edgePresets, presetPropsOf } from './edge-presets';

const control = (name: string, kind: string) => ({ name, kind, required: false });

const controls: Controls = [control('title', 'text'), control('hero', 'text'), control('count', 'number'), control('items', 'array'), control('open', 'toggle'), control('onclick', 'callback')];

const idsOf = (controls: Controls, base: Record<string, unknown> = {}) => edgePresets(controls, base).map((p) => p.id);

describe('edgePresets', () => {
  it('builds each preset from the declared prop types', () => {
    const all = Object.fromEntries(edgePresets(controls, {}).map((p) => [p.id, p.props]));

    expect(Object.keys(all[EdgePreset.LongText])).toEqual(['title', 'hero']);
    expect((all[EdgePreset.LongText].title as string).length).toBe(EDGE_LONG_TEXT_LENGTH);
    expect(all[EdgePreset.Empty]).toEqual({ title: '', hero: '', items: [] });
    expect(all[EdgePreset.ExtremeNumbers]).toEqual({ count: 0 });
  });

  it('gives a missing url to the props named like an image', () => {
    const [missing] = edgePresets([control('imageUrl', 'text'), control('title', 'text'), control('src', 'text')], {}).filter((p) => p.id === EdgePreset.MissingImage);

    expect(Object.keys(missing.props)).toEqual(['imageUrl', 'src']);
    expect(missing.props.src).toMatch(/^https?:\/\//);
  });

  it('cycles through zero, minus one and a huge number', () => {
    const numbers = [control('a', 'number'), control('b', 'number'), control('c', 'number'), control('d', 'number')];

    expect(edgePresets(numbers, {}).find((p) => p.id === EdgePreset.ExtremeNumbers)?.props).toEqual({ a: 0, b: -1, c: 999999, d: 0 });
  });

  it('leaves out a preset that would change nothing', () => {
    expect(idsOf([control('n', 'number')], { n: 0 })).toEqual([]);
    expect(idsOf([control('title', 'text')], { title: '' })).toEqual([EdgePreset.LongText]);
  });

  it('is empty without controls or without usable props', () => {
    expect(idsOf(null)).toEqual([]);
    expect(idsOf([control('open', 'toggle'), control('onclick', 'callback')])).toEqual([]);
  });
});

describe('presetPropsOf', () => {
  it('is the props of the chosen preset', () => {
    expect(presetPropsOf(EdgePreset.Empty, controls, {})).toEqual({ title: '', hero: '', items: [] });
  });

  it('is nothing for a code example id or a preset that no longer applies', () => {
    expect(presetPropsOf('src/p.svelte:1', controls, {})).toEqual({});
    expect(presetPropsOf(EdgePreset.Empty, [control('n', 'number')], {})).toEqual({});
    expect(presetPropsOf(undefined, controls, {})).toEqual({});
  });
});
