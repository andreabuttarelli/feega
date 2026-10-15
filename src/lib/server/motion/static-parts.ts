import { parseHTML } from 'linkedom';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { CUSTOM_CLIP } from '$lib/motion/poster-parts';
import type { MotionDoc } from '$lib/motion/doc';

type Parts = Record<string, string[]>;
type Schema = { properties?: Record<string, { default?: unknown }> };

const PART_ATTR = 'data-part';
const CONTEXT = 'root,props,tl,duration,fps,assets,brand,rand,param,format,motion';

let trusted: ReadonlySet<string> | null = null;

function builtinSources(): ReadonlySet<string> {
  trusted ??= new Set(BUILTIN_TEMPLATES.flatMap((e) => Object.values(e.template.doc.components).map((c) => c.source.js)).filter((js) => js.includes(PART_ATTR)));
  return trusted;
}

const inert: object = new Proxy(() => inert, { get: () => inert, apply: () => inert });

const defaultsOf = (schema: Schema) => Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, spec]) => [key, spec.default]));

function renderedParts(js: string, props: Record<string, unknown>, size: { width: number; height: number }): string[] {
  const { document } = parseHTML(`<html><body><div style="width:${size.width}px;height:${size.height}px"></div></body></html>`);
  const root = document.body.firstElementChild as unknown as HTMLElement;
  const run = new Function('ctx', 'document', 'window', `"use strict";const {${CONTEXT}}=ctx;{\n${js}\n}`);
  try {
    run({ root, props, tl: inert, duration: 1, fps: 30, assets: {}, brand: { name: '', colors: {}, logoUrl: null }, rand: () => 0.5, param: inert, format: inert, motion: inert }, document, undefined);
  } catch {
    return [];
  }
  return [...root.querySelectorAll(`[${PART_ATTR}]`)].map((el) => el.getAttribute(PART_ATTR) ?? '').filter(Boolean);
}

export function staticParts(doc: MotionDoc): Parts {
  const sources = builtinSources();
  const parts: Parts = {};
  for (const clip of doc.tracks.flatMap((t) => t.clips)) {
    const component = clip.component === CUSTOM_CLIP ? doc.components[String(clip.props.name)] : undefined;
    if (!component || !sources.has(component.source.js)) {
      continue;
    }
    const found = renderedParts(component.source.js, { ...defaultsOf(component.propsSchema as Schema), ...clip.props }, doc);
    if (found.length) {
      parts[clip.id] = [...new Set(found)];
    }
  }
  return parts;
}
