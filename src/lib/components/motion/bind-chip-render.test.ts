import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable, setActiveMode } from '$lib/motion/variables';
import MotionInspector from './MotionInspector.svelte';
import BindChip from './BindChip.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's1'));
const themed = must(defineVariable(base, 'Theme', 'surface', { type: VarType.Colour, values: { Light: '#ffffff', Dark: '#101010' } }, ['Light', 'Dark']));
const sized = must(defineVariable(themed, 'Size', 'radius', { type: VarType.Number, values: { Default: 0.25 } }));
const bound = must(bindVariable(sized, 's1', 'fill', 'Theme/surface'));

const inspect = (doc: MotionDoc) => render(MotionInspector, { props: { doc, clip: findClip(doc, 's1')!.clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;
const chip = (doc: MotionDoc, target: string) => render(BindChip, { props: { doc, clip: findClip(doc, 's1')!.clip, target, commit: () => {} } }).body;

describe('the bind chip', () => {
  it('sits next to a colour field when the doc has a colour variable', () => {
    expect(inspect(themed)).toContain('data-testid="bind-chip-fill"');
  });

  it('sits in the fill section for the fill stack', () => {
    const body = inspect(themed);
    expect(body).toContain('data-testid="bind-chip-fill"');
  });

  it('a bound fill shows the variable instead of the stack', () => {
    const body = inspect(bound);
    expect(body).toContain('data-bound="Theme/surface"');
  });

  it('sits next to a number field when the doc has a number variable', () => {
    expect(inspect(sized)).toContain('data-testid="bind-chip-roundness"');
  });

  it('is absent while the doc has no variable', () => {
    expect(inspect(base)).not.toContain('data-testid="bind-chip-');
  });

  it('a bound field shows the variable name and an unbind', () => {
    const body = chip(bound, 'fill');
    expect(body).toContain('Theme/surface');
    expect(body).toContain('data-testid="bind-unbind-fill"');
  });

  it('a bound field follows the mode', () => {
    expect(chip(bound, 'fill')).toContain('#ffffff');
    expect(chip(must(setActiveMode(bound, 'Theme', 'Dark')), 'fill')).toContain('#101010');
  });

  it('an unbound chip has no unbind', () => {
    expect(chip(themed, 'fill')).not.toContain('bind-unbind-fill');
  });
});
