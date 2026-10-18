import { describe, expect, it } from 'vitest';
import { setProps } from './timeline';
import { applyValues } from './template/fields';
import { interactiveOf } from './interactive/settings';
import { mergeView, viewOf } from './precomp';
import { SPLIT_CLIP, SPLIT_HEADLINE_TEMPLATE } from './template/split-headline/template';
import type { MotionDoc } from './doc';

const ASSET = '0b0c7e5e-1f3a-4c55-9d0e-1a2b3c4d5e6f';
const doc = SPLIT_HEADLINE_TEMPLATE.template.doc;
const varOf = (d: MotionDoc, name: string) => interactiveOf(d).vars.find((v) => v.name === name)?.default;

describe('a runtime variable follows the prop it drives', () => {
  it('setting the prop moves the variable default, so the frame shows the new value', () => {
    const set = setProps(doc, SPLIT_CLIP, { media: ASSET });

    expect(set.ok && varOf(set.doc, 'split_media')).toBe(ASSET);
  });

  it('a field edit reaches the variable too', () => {
    const set = applyValues(doc, { media: ASSET });

    expect(set.ok && varOf(set.doc, 'split_media')).toBe(ASSET);
  });

  it('a variable no prop drives keeps its default', () => {
    const set = setProps(doc, SPLIT_CLIP, { media: ASSET });

    expect(set.ok && varOf(set.doc, 'split_headline')).toBe(varOf(doc, 'split_headline'));
  });

  it('an edit made inside a composition view survives the merge back', () => {
    const view = { ...viewOf(doc, []), interactive: { ...interactiveOf(doc), vars: interactiveOf(doc).vars.map((v) => (v.name === 'split_media' ? { ...v, default: ASSET } : v)) } };
    const merged = mergeView({ ...doc, comps: { c: { name: 'c', durationInFrames: 10, tracks: [] } } }, ['c'], view as MotionDoc);

    expect(varOf(merged, 'split_media')).toBe(ASSET);
  });
});
