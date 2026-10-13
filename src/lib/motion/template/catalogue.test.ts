import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORMATS, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES, builtinTemplate } from './builtins';
import { PROMPT_TEMPLATE_ID } from './prompt-input/template';
import { ComponentKind, POSTER_FORMATS, catalogue, componentKind, matching, posterShelf, previewOf, starterDoc, starterFormatOf, STARTER_FORMATS } from './catalogue';
import { DocMode } from '$lib/motion/still';
import PREVIEWED from './previews.json';

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

    expect(items.map((i) => i.id).sort()).toEqual(BUILTIN_TEMPLATES.map((e) => e.id).sort());
    expect(items.find((i) => i.id === PROMPT_TEMPLATE_ID)?.kind).toBe(ComponentKind.Component);
  });

  it('leads with components, then media layouts, then scenes', () => {
    const kinds = catalogue(BUILTIN_TEMPLATES).map((i) => i.kind);
    const firstOf = (k: ComponentKind) => kinds.indexOf(k);
    const lastOf = (k: ComponentKind) => kinds.lastIndexOf(k);

    expect(lastOf(ComponentKind.Component)).toBeLessThan(firstOf(ComponentKind.Layout));
    expect(lastOf(ComponentKind.Layout)).toBeLessThan(firstOf(ComponentKind.Scene));
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

describe('the posters row', () => {
  it('holds only stills, each with its picture, ordered by name', () => {
    const items = catalogue(BUILTIN_TEMPLATES);
    const shelf = posterShelf(items);
    const names = shelf.map((i) => i.name);

    expect(shelf.length).toBe(items.filter((i) => i.mode === DocMode.Still).length);
    expect(shelf.every((i) => i.mode === DocMode.Still && i.preview?.poster.endsWith('.jpg'))).toBe(true);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(shelf.map((i) => i.id)).toEqual(expect.arrayContaining(['builtin:poster-iso-blocks', 'builtin:poster-photo-grid', 'builtin:poster-white-shapes', 'builtin:poster-vertical-type']));
  });

  it('starts in the print formats, 4:5 first', () => {
    expect(POSTER_FORMATS).toEqual([MotionFormat.Portrait, MotionFormat.Vertical, MotionFormat.Poster]);
  });
});

describe('previews are stored files, never rendered per view', () => {
  it('every listed preview has its poster under static/, and a video one its clip', () => {
    const items = catalogue(BUILTIN_TEMPLATES);
    const missing = PREVIEWED.flatMap((id) => {
      const preview = items.find((i) => i.id === id)?.preview ?? previewOf(id);
      return preview ? [preview.poster, preview.video].filter((path): path is string => path !== null).filter((path) => !existsSync(`static${path}`)) : [id];
    });

    expect(missing).toEqual([]);
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

describe('every built-in names its key fields', () => {
  it.each(BUILTIN_TEMPLATES.filter((e) => e.template.keyFields).map((e) => [e.id, e] as const))('%s declares only fields it exposes', (_id, e) => {
    const keys = new Set(e.template.doc.fields.map((f) => f.key));

    expect(e.template.keyFields?.every((k) => keys.has(k))).toBe(true);
  });

  it('prompt input leads with the typed text, the button, the theme and the accent', () => {
    expect(entry(PROMPT_TEMPLATE_ID).template.keyFields).toEqual(['text', 'button_label', 'theme', 'accent']);
  });

  it('the custom components declare theirs instead of relying on a guess', () => {
    const custom = catalogue(BUILTIN_TEMPLATES).filter((i) => i.kind === ComponentKind.Component);

    expect(custom.every((i) => entry(i.id).template.keyFields?.length)).toBe(true);
  });
});

describe('the library previews in the format of the video it inserts into', () => {
  it('keeps a starter format and falls back to landscape for any other', () => {
    expect(starterFormatOf(newMotionDoc(MotionFormat.Vertical))).toBe(MotionFormat.Vertical);
    expect(starterFormatOf({ width: 1080, height: 1350 })).toBe(MotionFormat.Landscape);
  });
});
