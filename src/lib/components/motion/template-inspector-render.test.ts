import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TemplateInspector from './TemplateInspector.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { insertTemplate } from '$lib/motion/template/library';
import { locateClip } from '$lib/motion/template/fields';
import { PROMPT_INPUT_TEMPLATE } from '$lib/motion/template/prompt-input/template';

function inspected(): string {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), PROMPT_INPUT_TEMPLATE, { from: 0, newId: () => `i${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  const clip = locateClip(placed.doc, placed.clipId)!.clip;
  return render(TemplateInspector, { props: { doc: placed.doc, clip, assets: [], onchange: () => {} } }).body;
}

const between = (body: string, from: string, to: string) => body.slice(body.indexOf(from), to ? body.indexOf(to) : undefined);

describe('the template inspector on a prompt input', () => {
  it('leads with the key fields: the typed text, the button, the theme and the accent', () => {
    const key = between(inspected(), 'data-testid="key-fields"', 'data-testid="advanced-fields"');

    expect(key).toContain('Typed text');
    expect(key).toContain('Button label');
    expect(key).toContain('Theme');
    expect(key).toContain('type="color"');
    expect(key).not.toContain('Corner radius when rounded');
  });

  it('keeps every other field in an Advanced section, closed by default, grouped as before', () => {
    const body = inspected();
    const advanced = between(body, 'data-testid="advanced-fields"', '');
    const groups = [...advanced.matchAll(/data-testid="field-group"[^>]*>([^<]+)</g)].map((m) => m[1]);

    expect(body).toMatch(/<details[^>]*data-testid="advanced-fields"/);
    expect(body).not.toMatch(/<details[^>]*open[^>]*data-testid="advanced-fields"/);
    expect(groups).toEqual(['Text', 'Style', 'Motion']);
    expect(advanced).toContain('Corner radius when rounded');
    expect(advanced).toContain('type="range"');
  });
});
