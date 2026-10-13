import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ComponentLibrary from './ComponentLibrary.svelte';
import ComponentDetail from './ComponentDetail.svelte';
import { MotionFormat } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES, builtinTemplate } from '$lib/motion/template/builtins';
import { AddTarget, catalogue, starterDoc, type StarterFormat } from '$lib/motion/template/catalogue';
import { PROMPT_TEMPLATE_ID } from '$lib/motion/template/prompt-input/template';
import { PROMPT_VAR_PREFIX } from '$lib/motion/template/prompt-input/component';
import { paramVar } from '$lib/motion/custom/component';

const items = catalogue(BUILTIN_TEMPLATES);

function draftOf(id: string, format: StarterFormat) {
  let n = 0;
  const made = starterDoc(builtinTemplate(id)!, format, () => `d${++n}`);
  return made.ok ? { doc: made.doc, clipId: made.clipId } : null;
}

const library = () => render(ComponentLibrary, { props: { items, format: MotionFormat.Landscape, draftOf, onpick: () => {}, onclose: () => {} } }).body;

const detail = () =>
  render(ComponentDetail, {
    props: { item: items.find((i) => i.id === PROMPT_TEMPLATE_ID)!, format: MotionFormat.Landscape, draftOf, compose: null, assets: [], onadd: () => {}, onclose: () => {} }
  }).body;

describe('the component library', () => {
  it('opens on one surface: category tabs, search and a grid of cards with a one-line description', () => {
    const body = library();

    expect(body).toContain('role="tablist"');
    expect(body).toContain('data-testid="component-search"');
    expect(body).toContain(`data-component="${PROMPT_TEMPLATE_ID}"`);
    expect(body).toContain('A prompt box types a request');
    expect(body).not.toContain('data-testid="component-detail"');
  });

  it('filters videos and stills, and marks a still card as one', () => {
    const body = library();

    expect(body).toContain('data-mode-tab="video"');
    expect(body).toContain('data-mode-tab="still"');
    expect(body).toMatch(/data-component="builtin:poster-type-grid"[^>]*data-mode="still"/);
  });

  it('has no Back button: a component opens beside the grid and closes in place', () => {
    expect(library()).not.toMatch(/>\s*Back\s*</);
    expect(detail()).toContain('data-testid="close-detail"');
  });
});

describe('a component opened in the library', () => {
  it('picked for a canvas composition, it offers to use it there, without the video sounds', () => {
    const body = render(ComponentDetail, {
      props: { item: items.find((i) => i.id === PROMPT_TEMPLATE_ID)!, format: MotionFormat.Landscape, draftOf, compose: null, assets: [], target: AddTarget.Composition, onadd: () => {}, onclose: () => {} }
    }).body;

    expect(body).toContain('Use in composition');
    expect(body).not.toContain('data-testid="add-sounds"');
  });

  it('shows its key fields with human labels and one primary action', () => {
    const body = detail();
    const key = body.slice(body.indexOf('data-testid="key-fields"'), body.indexOf('data-testid="advanced-fields"'));

    expect(key).toContain('Typed text');
    expect(key).toContain('type="color"');
    expect(key).not.toContain('data-testid="field-group"');
    expect(body).toContain('Add to video');
    expect(body).toContain('Add sounds');
    expect(body).toContain('16:9');
    expect(body).toContain('9:16');
    expect(body).toContain('1:1');
  });

  it('keeps every other field and the runtime variable names in Advanced, closed by default', () => {
    const body = detail();
    const advanced = body.slice(body.indexOf('data-testid="advanced-fields"'));

    expect(body).toMatch(/<details[^>]*data-testid="advanced-fields"/);
    expect(body).not.toMatch(/<details[^>]*open/);
    expect(advanced).toContain('Corner radius when rounded');
    expect(body.indexOf(paramVar(PROMPT_VAR_PREFIX, 'buttonLabel'))).toBeGreaterThan(body.indexOf('data-testid="advanced-fields"'));
  });
});
