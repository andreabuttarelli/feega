import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable } from '$lib/motion/variables';
import VariablesSection from './VariablesSection.svelte';
import VariablesLibrarySection from './VariablesLibrarySection.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's1'));
const themed = must(defineVariable(base, 'Theme', 'surface', { type: VarType.Colour, values: { Light: '#ffffff', Dark: '#101010' } }, ['Light', 'Dark']));
const bound = must(bindVariable(themed, 's1', 'fill', 'Theme/surface'));

describe('the variables sections', () => {
  it('the clip section is absent while the doc has no variables', () => {
    expect(render(VariablesSection, { props: { doc: base, clip: findClip(base, 's1')!.clip, commit: () => {} } }).body).not.toContain('Variables');
  });

  it('the clip section offers the variables and shows a binding with its unbind', () => {
    const body = render(VariablesSection, { props: { doc: bound, clip: findClip(bound, 's1')!.clip, commit: () => {} } }).body;
    expect(body).toContain('data-testid="variable-pick"');
    expect(body).toContain('Theme/surface');
    expect(body).toContain('data-testid="variable-unbind-fill"');
  });

  it('the library lists collections with their modes and a value per mode', () => {
    const body = render(VariablesLibrarySection, { props: { doc: themed, onchange: () => {} } }).body;
    expect(body).toContain('data-collection="Theme"');
    expect(body).toContain('data-testid="variable-value-Theme-surface-Light"');
    expect(body).toContain('data-testid="variable-value-Theme-surface-Dark"');
    expect(body).toContain('data-testid="variable-mode-Theme"');
  });
});
