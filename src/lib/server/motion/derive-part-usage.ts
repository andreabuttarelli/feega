import { PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { parsePart } from '$lib/motion/poster-parts';
import { PAGE, type PartUsage } from '$lib/motion/part-usage';
import { ShapePaint, markupPaint } from '$lib/motion/part-shapes';
import { PART_ATTR, defaultsOf, renderRoot, type Schema, type Size } from './static-parts';

type Rule = { selector: string; pseudo: boolean; decls: { prop: string; value: string }[] };
type Shot = { root: HTMLElement; parts: Map<string, string>; outside: Element[]; vars: Map<string, string> };

const PART = `[${PART_ATTR}]`;
const CUSTOM_PROP = /--[\w-]+\s*:[^;"]*;?/g;
const STYLE_ATTR = /style="([^"]*)"/g;
const PSEUDO = '::?(before|after|first-line|first-letter|placeholder|marker|selection)\\b';
const PSEUDO_ELEMENT = new RegExp(PSEUDO, 'g');
const HAS_PSEUDO = new RegExp(PSEUDO);
const SELF_PAINT = /^(background|border|outline|box-shadow)/;
const COLOUR_A = '#123456';
const COLOUR_B = '#654321';
const FONT = 'Perturbed Font';
const MARK = 'Q';
const NUMBER_STEPS = 3;
const TEXT_NODE = 3;

const nudgedNumber = (spec: PropSpec, value: number): number => {
  const step = (spec.step ?? 1) * NUMBER_STEPS;
  const up = value + step;
  return spec.maximum !== undefined && up > spec.maximum ? value - step : up;
};

const PERTURB: Record<string, (spec: PropSpec, value: unknown) => unknown> = {
  [PropFormat.Color]: (_s, v) => (v === COLOUR_A ? COLOUR_B : COLOUR_A),
  [PropFormat.Font]: () => FONT,
  string: (s, v) => (s.enum ? s.enum.find((o) => o !== v) : String(v ?? '').split('\n').map((l) => MARK + l).join('\n')),
  number: (s, v) => nudgedNumber(s, Number(v ?? 0)),
  integer: (s, v) => nudgedNumber(s, Number(v ?? 0)),
  boolean: (_s, v) => !v
};

const SKIPPED: ReadonlySet<string | undefined> = new Set([PropFormat.Media]);

const strip = (html: string) => html.replace(STYLE_ATTR, (_m, style: string) => `style="${style.replace(CUSTOM_PROP, '')}"`);

function rulesOf(css: string): Rule[] {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim(), body }))
    .filter(({ selector }) => !selector.startsWith('@') && !/^(from|to|\d)/.test(selector))
    .map(({ selector, body }) => ({
      selector: selector.replace(PSEUDO_ELEMENT, '').trim() || '*',
      pseudo: HAS_PSEUDO.test(selector),
      decls: body
        .split(';')
        .map((d) => d.split(':'))
        .filter((d) => d.length > 1)
        .map(([prop, ...rest]) => ({ prop: prop.trim(), value: rest.join(':') }))
    }));
}

function withoutInnerParts(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(PART).forEach((inner) => inner.replaceWith(copy.ownerDocument.createElement('i')));
  return copy.outerHTML;
}

function shotOf(root: HTMLElement): Shot {
  const parts = new Map<string, string>();
  for (const el of root.querySelectorAll(PART)) {
    parts.set(el.getAttribute(PART_ATTR)!, strip(withoutInnerParts(el)));
  }
  const vars = new Map<string, string>();
  for (const el of root.querySelectorAll('[style]')) {
    for (const [name, value] of [...(el.getAttribute('style') ?? '').matchAll(/(--[\w-]+)\s*:([^;]*)/g)].map((m) => [m[1], m[2]])) {
      vars.set(name, `${vars.get(name) ?? ''}|${value.trim()}`);
    }
  }
  const outside = [...root.querySelectorAll('*')].filter((el) => !el.closest(PART));
  return { root, parts, outside, vars };
}

const declsOf = (el: Element): Map<string, string> =>
  new Map([
    ...(el.getAttribute('style') ?? '')
      .split(';')
      .map((d) => d.split(':'))
      .filter((d) => d.length > 1 && !d[0].trim().startsWith('--'))
      .map(([prop, ...rest]): [string, string] => [prop.trim(), rest.join(':').trim()]),
    ...[...el.attributes].filter((a) => a.name !== 'style').map((a): [string, string] => [a.name, a.value]),
    ['tag', el.tagName]
  ]);

const ownText = (el: Element) => [...el.childNodes].filter((n) => n.nodeType === TEXT_NODE).map((n) => n.textContent).join('');

const partFields = (el: Element) => [...el.querySelectorAll(PART)].map((p) => parsePart(p.getAttribute(PART_ATTR)!).field);

const paintsOutside = (el: Element) => ownText(el).trim() !== '' || !el.querySelector(PART) || [...el.children].some((c) => !c.matches(PART) && !c.querySelector(PART));

function outsideReach(base: Shot, next: Shot): Set<string> {
  if (base.outside.length !== next.outside.length) {
    return new Set([PAGE]);
  }
  const hit = new Set<string>();
  base.outside.forEach((was, i) => {
    const now = next.outside[i];
    if (ownText(was) !== ownText(now)) {
      hit.add(PAGE);
    }
    const before = declsOf(was);
    const after = declsOf(now);
    for (const prop of new Set([...before.keys(), ...after.keys()]).values()) {
      if (before.get(prop) === after.get(prop)) {
        continue;
      }
      if (SELF_PAINT.test(prop) || paintsOutside(was)) {
        hit.add(PAGE);
      }
      if (!SELF_PAINT.test(prop)) {
        partFields(was).forEach((f) => hit.add(f));
      }
    }
  });
  return hit;
}

const safeAll = (root: HTMLElement, selector: string): Element[] => {
  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
};

function varReach(shot: Shot, rules: Rule[], name: string): Set<string> {
  const uses = (value: string) => value.includes(`var(${name}`);
  const paints = new Set<Element>();
  const passes = new Set<Element>();
  for (const rule of rules) {
    for (const decl of rule.decls.filter((d) => uses(d.value))) {
      const into = rule.pseudo || SELF_PAINT.test(decl.prop) ? paints : passes;
      safeAll(shot.root, rule.selector).forEach((el) => into.add(el));
    }
  }
  safeAll(shot.root, '[style]')
    .filter((el) => uses(el.getAttribute('style') ?? ''))
    .forEach((el) => passes.add(el));

  const inherits = (el: Element): boolean => {
    for (let at: Element | null = el; at; at = at.parentElement) {
      if (passes.has(at)) {
        return true;
      }
    }
    return false;
  };
  const touched = (el: Element) => paints.has(el) || inherits(el);
  const hit = new Set<string>();
  for (const el of safeAll(shot.root, PART)) {
    if (touched(el) || [...el.querySelectorAll('*')].some((d) => d.closest(PART) === el && touched(d))) {
      hit.add(parsePart(el.getAttribute(PART_ATTR)!).field);
    }
  }
  const outside = safeAll(shot.root, '*').filter((el) => !el.closest(PART));
  if (outside.some((el) => paints.has(el) || (!el.querySelector(PART) && inherits(el)))) {
    hit.add(PAGE);
  }
  return hit;
}

function usersOf(base: Shot, next: Shot, rules: Rule[]): Set<string> {
  const users = new Set<string>();
  for (const id of new Set([...base.parts.keys(), ...next.parts.keys()])) {
    if (base.parts.get(id) !== next.parts.get(id)) {
      users.add(parsePart(id).field);
    }
  }
  outsideReach(base, next).forEach((u) => users.add(u));
  for (const name of new Set([...base.vars.keys(), ...next.vars.keys()])) {
    if (base.vars.get(name) !== next.vars.get(name)) {
      varReach(base, rules, name).forEach((u) => users.add(u));
    }
  }
  return users;
}

const perturbOf = (spec: PropSpec) => (SKIPPED.has(spec.format) ? undefined : (PERTURB[spec.format ?? ''] ?? PERTURB[spec.type]));

export function derivePartUsage(component: CustomComponent, size: Size): PartUsage | null {
  const specs = (component.propsSchema.properties ?? {}) as Record<string, PropSpec>;
  const defaults = defaultsOf(component.propsSchema as Schema);
  const first = renderRoot(component.source.js, defaults, size);
  if (!first) {
    return null;
  }
  const base = shotOf(first);
  const rules = rulesOf(component.source.css);
  const parts: Record<string, number> = {};
  for (const id of base.parts.keys()) {
    const { field } = parsePart(id);
    parts[field] = (parts[field] ?? 0) + 1;
  }

  const paints = new Map<string, Set<ShapePaint | null>>();
  for (const el of first.querySelectorAll(PART)) {
    const { field } = parsePart(el.getAttribute(PART_ATTR)!);
    paints.set(field, (paints.get(field) ?? new Set()).add(markupPaint(el)));
  }
  const shapes = Object.fromEntries([...paints].filter(([, set]) => set.size === 1 && !set.has(null)).map(([field, set]) => [field, [...set][0]!]));

  const fields: Record<string, string[]> = {};
  for (const [key, spec] of Object.entries(specs)) {
    const perturb = perturbOf(spec);
    if (key === VAR_PREFIX || !perturb) {
      continue;
    }
    const root = renderRoot(component.source.js, { ...defaults, [key]: perturb(spec, defaults[key]) }, size);
    const users = root ? [...usersOf(base, shotOf(root), rules)].sort() : [];
    if (users.length) {
      fields[key] = users;
    }
  }
  return Object.keys(shapes).length ? { parts, fields, shapes } : { parts, fields };
}
