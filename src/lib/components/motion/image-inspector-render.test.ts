import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { EditMode } from '$lib/motion/edit-mode';
import MotionInspector from './MotionInspector.svelte';

function inspectImage(props: Record<string, unknown> = {}) {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, props: { assetId: 'photo', ...props } }, 'img');
  if (!added.ok) {
    throw new Error(added.error);
  }
  const clip = findClip(added.doc, 'img')!.clip;
  return render(MotionInspector, { props: { doc: added.doc, clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, mode: EditMode.Design, onchange: () => {} } }).body;
}

const sections = (html: string) => [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);

describe('an image layer in Properties', () => {
  it('has a corner radius in Appearance, like a rectangle', () => {
    expect(inspectImage()).toContain('data-testid="radius"');
  });

  it('has Fill and Stroke sections, each with its add button', () => {
    const html = inspectImage();
    expect(sections(html)).toEqual(expect.arrayContaining(['fill', 'stroke']));
    expect(html).toContain('data-testid="fill-add"');
    expect(html).toContain('data-testid="stroke-add"');
  });

  it('crop and zoom read in percent', () => {
    const html = inspectImage();
    expect(html).toMatch(/aria-label="Crop X"[^>]*value="50"/);
    expect(html).toMatch(/aria-label="Zoom inside the box"[^>]*value="100"/);
  });
});
