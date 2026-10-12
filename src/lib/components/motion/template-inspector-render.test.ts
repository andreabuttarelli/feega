import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TemplateInspector from './TemplateInspector.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { insertTemplate } from '$lib/motion/template/library';
import { locateClip } from '$lib/motion/template/fields';
import { PROMPT_INPUT_TEMPLATE } from '$lib/motion/template/prompt-input/template';

describe('the template inspector on a prompt input', () => {
  it('shows its fields under Text, Style and Motion, with colour pickers and sliders', () => {
    let n = 0;
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), PROMPT_INPUT_TEMPLATE, { from: 0, newId: () => `i${++n}` });
    if (!placed.ok) {
      throw new Error(placed.error);
    }
    const clip = locateClip(placed.doc, placed.clipId)!.clip;

    const body = render(TemplateInspector, { props: { doc: placed.doc, clip, assets: [], onchange: () => {} } }).body;
    const groups = [...body.matchAll(/data-testid="field-group"[^>]*>([^<]+)</g)].map((m) => m[1]);

    expect(groups).toEqual(['Text', 'Style', 'Motion']);
    expect(body).toContain('type="color"');
    expect(body).toContain('type="range"');
    expect(body).toContain('Corner radius when rounded');
  });
});
