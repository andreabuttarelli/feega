export type OutlineBox = { y: number; height: number; width: number };

export type OutlineBlock = {
  tag: string;
  role?: string;
  label?: string;
  hint?: string;
  heading?: string;
  h1?: boolean;
  pinned?: boolean;
  background?: string;
  pictures?: number;
  quotes?: number;
  toggles?: number;
  box: OutlineBox;
  children?: OutlineBlock[];
};

export type PageOutline = { width: number; height: number; root: OutlineBlock };

export type OutlineLimits = { minWidth: number; minHeight: number; depth: number; text: number };

export const OUTLINE_LIMITS: OutlineLimits = { minWidth: 0.5, minHeight: 24, depth: 10, text: 80 };

export function pageOutlineOf(limits: OutlineLimits, height: number): PageOutline {
  const SKIPPED = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|META|LINK|TITLE|BR|WBR|DIALOG|SVG|IMG|PICTURE|VIDEO|CANVAS|IFRAME)$/;
  const HEADINGS = 'h1, h2, h3, [role=heading]';
  const HINT = /^[a-z][a-z-]{2,30}$/i;
  const width = document.documentElement.clientWidth;
  const round = (v: number) => Math.round(v);
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, limits.text);

  const hintOf = (el: Element) => {
    const words = [el.id, ...Array.from(el.classList)].filter((w) => HINT.test(w) && !/\d/.test(w));
    return clean(words.slice(0, 6).join(' ')) || undefined;
  };
  const backgroundOf = (css: CSSStyleDeclaration) => {
    if (css.backgroundImage !== 'none') {
      return 'image';
    }
    return /rgba\(.*,\s*0\)$|transparent/.test(css.backgroundColor) ? undefined : css.backgroundColor;
  };
  const shownIn = (el: Element) => {
    const css = getComputedStyle(el);
    return css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0;
  };

  const kidsOf = (el: Element, depth: number): OutlineBlock[] => (depth < limits.depth ? Array.from(el.children).flatMap((c) => blocksOf(c, depth + 1)) : []);

  const blocksOf = (el: Element, depth: number): OutlineBlock[] => {
    if (SKIPPED.test(el.tagName.toUpperCase()) || !shownIn(el)) {
      return [];
    }
    const css = getComputedStyle(el);
    if (css.display === 'contents') {
      return kidsOf(el, depth);
    }
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    if (r.width < width * limits.minWidth || top >= height) {
      return [];
    }
    if (r.height < limits.minHeight) {
      return kidsOf(el, depth);
    }
    const heading = el.matches(HEADINGS) ? el : el.querySelector(HEADINGS);
    const kids = kidsOf(el, depth);
    return [{
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? undefined,
      label: clean(el.getAttribute('aria-label')) || undefined,
      hint: hintOf(el),
      heading: heading instanceof HTMLElement ? clean(heading.innerText || heading.textContent) || undefined : undefined,
      h1: el.matches('h1') || el.querySelector('h1') ? true : undefined,
      pinned: /fixed|sticky/.test(css.position) || undefined,
      background: backgroundOf(css),
      pictures: el.querySelectorAll('img, svg, picture').length || undefined,
      quotes: el.querySelectorAll('blockquote, q').length || undefined,
      toggles: el.querySelectorAll('details').length || undefined,
      box: { y: round(top), height: round(Math.min(r.height, height - top)), width: round(r.width) },
      ...(kids.length ? { children: kids } : {})
    }];
  };

  const root = blocksOf(document.body, 0)[0] ?? { tag: 'body', box: { y: 0, height, width } };
  return { width, height, root };
}

export const outlineScript = (height: number, limits: OutlineLimits = OUTLINE_LIMITS) => `var __name = (f) => f; (${pageOutlineOf.toString()})(${JSON.stringify(limits)}, ${height})`;
