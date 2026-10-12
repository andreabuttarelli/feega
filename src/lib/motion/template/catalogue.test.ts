import { describe, expect, it } from 'vitest';
import { FORMATS, MotionFormat } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES, builtinTemplate } from './builtins';
import { PROMPT_TEMPLATE_ID } from './prompt-input/template';
import { ComponentKind, catalogue, componentKind, matching, starterDoc, STARTER_FORMATS } from './catalogue';

const entry = (id: string) => {
  const found = builtinTemplate(id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

describe('the component library lists whatever is registered', () => {
  it('has one item per built-in, prompt input among them', () => {
    const items = catalogue(BUILTIN_TEMPLATES);

    expect(items.map((i) => i.id)).toEqual(BUILTIN_TEMPLATES.map((e) => e.id));
    expect(items.find((i) => i.id === PROMPT_TEMPLATE_ID)?.kind).toBe(ComponentKind.Component);
  });

  it('sorts a custom component, a media layout and a plain scene into their kinds', () => {
    expect(componentKind(entry(PROMPT_TEMPLATE_ID))).toBe(ComponentKind.Component);
    expect(componentKind(entry('builtin:composition-bento'))).toBe(ComponentKind.Layout);
    expect(componentKind(entry('builtin:launch-ui-explode'))).toBe(ComponentKind.Scene);
    expect(componentKind(entry('builtin:title-card'))).toBe(ComponentKind.Scene);
  });

  it('finds by name or description, within a kind', () => {
    const items = catalogue(BUILTIN_TEMPLATES);

    expect(matching(items, 'prompt', null).map((i) => i.id)).toContain(PROMPT_TEMPLATE_ID);
    expect(matching(items, '', ComponentKind.Layout).every((i) => i.kind === ComponentKind.Layout)).toBe(true);
    expect(matching(items, 'prompt', ComponentKind.Layout)).toEqual([]);
  });
});

describe('a new video starts from a component', () => {
  it('holds the component at frame 0, as long as the component, in the chosen format', () => {
    const prompt = entry(PROMPT_TEMPLATE_ID);
    const started = starterDoc(prompt, MotionFormat.Vertical, (() => { let n = 0; return () => `id${++n}`; })());
    if (!started.ok) {
      throw new Error(started.error);
    }

    const precomp = started.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === started.clipId);
    expect(precomp?.from).toBe(0);
    expect(started.doc.durationInFrames).toBe(prompt.template.doc.durationInFrames);
    expect(started.doc.fps).toBe(prompt.template.doc.fps);
    expect({ width: started.doc.width, height: started.doc.height }).toEqual({ width: FORMATS[MotionFormat.Vertical].width, height: FORMATS[MotionFormat.Vertical].height });
    expect(started.doc.fields.length).toBe(prompt.template.doc.fields.length);
  });

  it('offers landscape, vertical and square', () => {
    expect(STARTER_FORMATS).toEqual([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square]);
  });
});
