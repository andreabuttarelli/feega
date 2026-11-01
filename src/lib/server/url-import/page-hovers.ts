import type { RestNode } from '$lib/server/figma/rest-message';

export type PageHover = NonNullable<RestNode['hover']>;

export type HoverLimits = { rules: number; perRule: number; elements: number; attr: string };

export const HOVER_LIMITS: HoverLimits = { rules: 400, perRule: 64, elements: 400, attr: 'data-feega-hover' };

export type HoverKit = { read: () => Map<Element, PageHover> };

export function pageHovers(limits: HoverLimits): HoverKit {
  const HOVER = /:hover\b/;
  const HOVERS = /:hover\b/g;
  const NEGATED = /:not\([^)]*:hover/;
  const MS = 1000;

  type Look = { fill: string; color: string; stroke: string; opacity: number; scale: number };

  const splitList = (list: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      depth += c === '(' ? 1 : c === ')' ? -1 : 0;
      if (c === ',' && depth === 0) {
        parts.push(list.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(list.slice(start).trim());
    return parts.filter(Boolean);
  };

  const lastCompound = (selector: string): string => {
    let depth = 0;
    let cut = 0;
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      depth += c === '(' || c === '[' ? 1 : c === ')' || c === ']' ? -1 : 0;
      if (depth === 0 && /[\s>+~]/.test(c)) {
        cut = i + 1;
      }
    }
    return selector.slice(cut);
  };

  const onSubject = (selector: string) => HOVER.test(lastCompound(selector)) && !HOVER.test(selector.slice(0, selector.length - lastCompound(selector).length)) && !NEGATED.test(selector);

  const applies = (rule: CSSRule): boolean => {
    if (rule instanceof CSSMediaRule) {
      return window.matchMedia(rule.conditionText).matches;
    }
    if (rule instanceof CSSSupportsRule) {
      return CSS.supports(rule.conditionText);
    }
    return true;
  };

  const hoverRules = (): CSSStyleRule[] => {
    const found: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (found.length >= limits.rules) {
          return;
        }
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(':hover')) {
          found.push(rule);
          continue;
        }
        if ('cssRules' in rule && !(rule instanceof CSSStyleRule) && applies(rule)) {
          walk((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
      try {
        walk(sheet.cssRules);
      } catch {
        continue;
      }
    }
    return found;
  };

  const select = (selector: string): Element[] => {
    try {
      return [...document.querySelectorAll(selector)].slice(0, limits.perRule);
    } catch {
      return [];
    }
  };

  const scaleOf = (transform: string) => {
    const m = transform.match(/matrix\(([^)]+)\)/);
    const [a, b] = m ? m[1].split(',').map(Number) : [1, 0];
    return Math.hypot(a, b);
  };

  const lookOf = (el: Element): Look => {
    const css = getComputedStyle(el);
    return { fill: css.backgroundColor, color: css.color, stroke: css.borderTopWidth !== '0px' ? css.borderTopColor : '', opacity: Number(css.opacity), scale: scaleOf(css.transform) };
  };

  const restyledAtRest = (el: Element) => getComputedStyle(el).backgroundColor;

  const durationOf = (css: CSSStyleDeclaration) => Math.max(0, ...css.transitionDuration.split(',').map((d) => (d.trim().endsWith('ms') ? parseFloat(d) : parseFloat(d) * MS)).filter(Number.isFinite));

  const read = () => {
    const probes: string[] = [];
    const targets = new Set<Element>();
    for (const rule of hoverRules()) {
      for (const selector of splitList(rule.selectorText).filter(onSubject)) {
        const base = selector.replace(HOVERS, '') || '*';
        probes.push(`${selector.replace(HOVERS, `[${limits.attr}]`)}{${rule.style.cssText}}`);
        select(base).forEach((el) => targets.size < limits.elements && targets.add(el));
      }
    }
    const timing = new Map([...targets].map((el) => [el, { durationMs: Math.round(durationOf(getComputedStyle(el))), easing: getComputedStyle(el).transitionTimingFunction.split(',')[0].trim() }]));
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`*,*::before,*::after{transition:none!important}\n${probes.join('\n')}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const hovers = new Map<Element, PageHover>();
    for (const el of targets) {
      const rest = lookOf(el);
      el.setAttribute(limits.attr, '');
      const hovered = lookOf(el);
      el.removeAttribute(limits.attr);
      restyledAtRest(el);
      const changed: Partial<Look> = Object.fromEntries((Object.keys(rest) as (keyof Look)[]).filter((k) => rest[k] !== hovered[k]).map((k) => [k, hovered[k]]));
      if (Object.keys(changed).length) {
        hovers.set(el, { ...changed, ...timing.get(el)! });
      }
    }
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    return hovers;
  };

  return { read };
}
