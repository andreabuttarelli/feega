// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { WHITE_SHAPES_POSTER_TEMPLATE } from '$lib/motion/template/white-shapes-poster/template';
import { PartKind, partIcon, partKind } from '$lib/motion/poster-parts';
import { setPartFills } from '$lib/motion/part-style';
import { partStyleCss } from '$lib/motion/hyperframes/part-styles';
import { FillType, fillsSchema } from '$lib/motion/fill/model';
import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { PART_ATTR, defaultsOf, renderRoot, staticParts, type Schema } from './static-parts';

const GEOMETRY = 'path,rect,circle,ellipse,polygon,polyline,line';
const MEDIA = 'image,img,video,lineargradient,radialgradient,pattern,clippath,filter';
const PINK = '#ff00aa';
const PINK_RGB = 'rgb(255, 0, 170)';

type Case = [string, MotionDoc, MotionClip, string, Element];

const customClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Custom') as MotionClip[];

function rendered(doc: MotionDoc, clip: MotionClip): HTMLElement | null {
  const component = doc.components[String(clip.props.name)];
  return renderRoot(component.source.js, { ...defaultsOf(component.propsSchema as Schema), ...clip.props }, doc);
}

const cases: Case[] = BUILTIN_TEMPLATES.flatMap((entry) => {
  const doc = entry.template.doc;
  const found = staticParts(doc);
  return customClips(doc).flatMap((clip) => {
    const root = found[clip.id] ? rendered(doc, clip) : null;
    return (found[clip.id] ?? []).map((part): Case => [`${entry.id} ${part}`, doc, clip, part, root!.querySelector(`[${PART_ATTR}="${part}"]`)!]);
  });
});

const tagsOf = (el: Element) => [el, ...el.querySelectorAll('*')].map((e) => e.tagName.toLowerCase());
const drawsGeometry = (el: Element) => tagsOf(el).some((t) => GEOMETRY.split(',').includes(t));
const holdsMedia = (el: Element) => tagsOf(el).some((t) => MEDIA.split(',').includes(t));
const isHitArea = (el: Element) => ['transparent', 'none'].includes(el.getAttribute('fill') ?? '');
const isShape = (el: Element) => !(el.textContent ?? '').trim() && !holdsMedia(el) && !isHitArea(el) && (drawsGeometry(el) || el.children.length === 0);
const MARKED = new Set([PartKind.Photo, PartKind.Arrow]);

const fieldOf = ([name, , clip, part]: Case) => `${name.split(' ')[0]} ${clip.id} ${part.split(':')[0]}`;
const mixed = new Set(cases.filter(([, , , , el]) => !isShape(el)).map(fieldOf));
const shapeCases = cases.filter((c) => isShape(c[4]) && !mixed.has(fieldOf(c)) && !MARKED.has(partKind(c[1], c[2], c[3])));
const textCases = cases.filter(([, , , , el]) => (el.textContent ?? '').trim() !== '');

describe('a poster part is the kind its markup draws', () => {
  it('there are shapes to check across the builtin posters', () => {
    expect(shapeCases.length).toBeGreaterThan(20);
  });

  it.each(shapeCases)('%s is a shape', (_name, doc, clip, part) => {
    expect(partKind(doc, clip, part)).toBe(PartKind.Shape);
    expect(partIcon(doc, clip, part)).toBe('shape');
  });

  it.each(textCases)('%s is never a shape', (_name, doc, clip, part) => {
    expect(partKind(doc, clip, part)).not.toBe(PartKind.Shape);
  });
});

function paintedAfter(doc: MotionDoc, clip: MotionClip, part: string): { el: Element; css: string } {
  const result = setPartFills(doc, clip.id, part, fillsSchema.parse([{ type: FillType.Solid, color: PINK }]));
  if (!result.ok) {
    throw new Error(result.error);
  }
  const after = findClip(result.doc, clip.id)!.clip;
  const css = partStyleCss([after], (c) => c, () => null);
  document.body.innerHTML = `<div data-clip="${clip.id}">${rendered(result.doc, after)!.innerHTML}</div><style>${css}</style>`;
  return { el: document.querySelector(`[data-clip] [${PART_ATTR}="${part}"]`)!, css };
}

const matches = (node: Element, selector: string) => {
  try {
    return node.matches(selector);
  } catch {
    return false;
  }
};

function paintedPink(node: Element, css: string): boolean {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => new RegExp(`(fill|background-color):${PINK} !important`).test(body));
  return node.getAttribute('fill') === PINK || (node.getAttribute('style') ?? '').includes(PINK) || rules.some(([, selector]) => matches(node, selector));
}

describe('a new colour on a shape reaches what paints it', () => {
  it.each(shapeCases)('%s', (_name, doc, clip, part) => {
    const { el, css } = paintedAfter(doc, clip, part);
    const painters = el.matches(GEOMETRY) || el.children.length === 0 ? [el] : [...el.querySelectorAll(GEOMETRY)];
    expect(painters.some((node) => paintedPink(node, css) || paintedPink(node.closest('[fill]') ?? node, css))).toBe(true);
  });
});

describe('poster white shapes', () => {
  const doc = WHITE_SHAPES_POSTER_TEMPLATE.template.doc;
  const clip = customClips(doc)[0];

  it('a block is a shape, its colour override lands on the polygon', () => {
    expect(partKind(doc, clip, 'shapes:0')).toBe(PartKind.Shape);
    expect(getComputedStyle(paintedAfter(doc, clip, 'shapes:0').el).fill).toBe(PINK);
  });

  it('the other blocks keep the shape colour', () => {
    const { el } = paintedAfter(doc, clip, 'shapes:0');
    expect(getComputedStyle(el.parentElement!.querySelector(`[${PART_ATTR}="shapes:1"]`)!).fill).not.toBe(PINK);
  });
});
