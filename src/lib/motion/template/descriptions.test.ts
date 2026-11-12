import { describe, expect, it } from 'vitest';
import { DocMode } from '@feega/motion-core/motion/still';
import { FORMATS, MotionFormat } from '@feega/motion-core/motion/doc';
import { CANVAS_TEMPLATES } from '$lib/canvas/templates';
import { BUILTIN_TEMPLATES } from './builtins';
import { ARC_TEMPLATES } from './arc';
import { ComponentKind, catalogue, matching } from './catalogue';

const MIN_CHARS = 60;
const MAX_CHARS = 320;
const SENTENCE_END = /[.!?)]$/;
const BOILERPLATE = [/\bclean template\b/i, /lorem ipsum/i, /\bbeautiful\b/i, /\bstunning\b/i, /eye-catching/i, /\bsleek\b/i, /perfect for/i, /\bTODO\b/, /undefined/, /written for this workspace/i];

type Described = { id: string; description: string };

const MOTION: Described[] = [...BUILTIN_TEMPLATES, ...ARC_TEMPLATES].map((e) => ({ id: e.id, description: e.template.description }));
const CANVAS: Described[] = CANVAS_TEMPLATES.map((t) => ({ id: t.id, description: t.description }));

const SOURCES: [string, Described[]][] = [
  ['motion', MOTION],
  ['canvas', CANVAS]
];

const repeated = (items: Described[]) => items.filter((a, i) => items.findIndex((b) => b.description === a.description) !== i).map((a) => a.id);

describe.each(SOURCES)('every %s template tells the agent what it is', (_source, items) => {
  it(`has a description of ${MIN_CHARS}–${MAX_CHARS} characters`, () => {
    expect(items.filter((i) => i.description.trim().length < MIN_CHARS || i.description.length > MAX_CHARS).map((i) => `${i.id} (${i.description.length})`)).toEqual([]);
  });

  it('has a description that ends a sentence, never cut mid-word', () => {
    expect(items.filter((i) => !SENTENCE_END.test(i.description.trim())).map((i) => i.id)).toEqual([]);
  });

  it('has a description no other template shares', () => {
    expect(repeated(items)).toEqual([]);
  });

  it('has no boilerplate in its description', () => {
    expect(items.filter((i) => BOILERPLATE.some((b) => b.test(i.description))).map((i) => i.id)).toEqual([]);
  });
});

describe('the catalogue search reads what the agent filters by', () => {
  const items = catalogue(BUILTIN_TEMPLATES);

  it('finds stills by mode', () => {
    const stills = items.filter((i) => i.mode === DocMode.Still);
    expect(stills.length).toBeGreaterThan(0);
    expect(matching(items, DocMode.Still, null)).toEqual(expect.arrayContaining(stills));
  });

  it('finds portrait templates by aspect', () => {
    const portrait = items.filter((i) => i.format === MotionFormat.Portrait);
    expect(portrait.length).toBeGreaterThan(0);
    expect(matching(items, FORMATS[MotionFormat.Portrait].label, null)).toEqual(expect.arrayContaining(portrait));
  });

  it('finds media layouts by kind', () => {
    expect(matching(items, ComponentKind.Layout, null).some((i) => i.kind === ComponentKind.Layout)).toBe(true);
  });
});
