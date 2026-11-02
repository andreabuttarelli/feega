import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import StyleSection from './StyleSection.svelte';

function section(component: 'Shape' | 'Text') {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component, from: 0 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return render(StyleSection, { props: { doc: added.doc, clip: findClip(added.doc, 'c1')!.clip, commit: () => {} } }).body;
}

describe('creating a style from a layer', () => {
  it('is one Create style menu, not a row of save buttons', () => {
    const html = section('Shape');
    expect(html).toContain('data-testid="style-create"');
    expect(html).not.toContain('Save colour style');
    expect(html).not.toContain('Save fill style');
  });
});
