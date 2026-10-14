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

describe('the frame templates picker', () => {
  it('is called Frame templates, with one search field and Video / Still', () => {
    const body = library();

    expect(body).toContain('aria-label="Frame templates"');
    expect(body).toMatch(/<h2[^>]*>Frame templates<\/h2>/);
    expect(body).toContain('placeholder="Search frame templates"');
    expect(body).toMatch(/role="radiogroup"[^>]*aria-label="Video or still"/);
    expect(body).toMatch(/role="radio"[^>]*>\s*Video\s*</);
    expect(body).toMatch(/role="radio"[^>]*>\s*Still\s*</);
    expect(body).not.toMatch(/components/i);
  });

  it('offers the roles of the template cards as chips', () => {
    expect(library()).toContain('data-role="opener"');
  });

  it('shows each template in its real format, grouped by shape, with a one-line meta', () => {
    const body = library();

    expect(body).toContain('data-shape="16:9"');
    expect(body).toContain('data-shape="4:5"');
    expect(body).toMatch(/data-component="builtin:poster-type-grid"[^>]*data-mode="still"/);
    expect(body).toContain('4:5 · still');
  });

  it('opens quiet: posters only, lazy, no player and no description text', () => {
    const body = library();

    expect(body).toContain('loading="lazy"');
    expect(body).not.toContain('<video');
    expect(body).not.toContain('A prompt box types a request');
    expect(body).not.toContain('data-testid="component-detail"');
  });

  it('says so when nothing is listed', () => {
    const empty = render(ComponentLibrary, { props: { items: [], format: MotionFormat.Landscape, draftOf, onpick: () => {}, onclose: () => {} } }).body;

    expect(empty).toContain('data-testid="frame-templates-empty"');
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
