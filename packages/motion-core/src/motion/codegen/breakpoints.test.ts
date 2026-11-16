import { describe, expect, it } from 'vitest';
import { Direction, Sizing } from '../layout/auto-layout';
import type { MotionDoc } from '../doc';
import { addBreakpoint, BreakpointPreset, OverrideKey, setOverride } from '../breakpoints/model';
import { CodeTarget, exportCode } from './index';
import { box, DocKit } from './fixtures/kit';
import { PHONE, TABLET, compMainDoc, must, tallViewsDoc, viewOnlyDoc, withViews } from './fixtures/responsive';

const must = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function page(): MotionDoc {
  const kit = new DocKit(1440, 900);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1440, 900), fill: '#ffffff', layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.frame('row', { name: 'Row', parent: 'page', box: box(0, 0, 1440, 200), layout: { direction: Direction.Horizontal, gap: 32 }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('lead', 'Lead', { parent: 'row', name: 'Lead', size: 48, font: 'Inter' });
  kit.text('aside', 'Aside', { parent: 'row', name: 'Aside', size: 16, font: 'Inter' });
  return kit.doc();
}

function phoneStacked(): MotionDoc {
  const phone = must(addBreakpoint(page(), BreakpointPreset.Phone, 'ph'));
  const stacked = must(setOverride(phone, 'ph', 'row', OverrideKey.Direction, Direction.Vertical));
  return must(setOverride(stacked, 'ph', 'aside', OverrideKey.Hidden, true));
}

const file = (doc: MotionDoc, target: CodeTarget, suffix: string) =>
  exportCode(doc, { target, name: 'Page' })
    .files.filter((f) => f.path.endsWith(suffix))
    .map((f) => f.content)
    .join('\n');

describe('code export with breakpoints', () => {
  it('a frame without breakpoints exports no media queries', () => {
    expect(file(page(), CodeTarget.Html, '.css')).not.toContain('@media');
    expect(file(page(), CodeTarget.React, '.tsx')).not.toContain('max-[');
  });

  it('HTML: a phone override becomes a max-width media query on that element only', () => {
    const css = file(phoneStacked(), CodeTarget.Html, 'page.css');
    const queried = [...css.matchAll(/@media \(max-width: 390px\) \{\s+\.([a-z-]+) \{\s+([^}]+)\}/g)].map((m) => [m[1], m[2].trim()]);

    expect(queried).toEqual([
      ['row', 'flex-direction: column;'],
      ['aside', 'display: none;']
    ]);
  });

  it('React: overrides become max-[391px] variants (Tailwind max is exclusive)', () => {
    const tsx = file(phoneStacked(), CodeTarget.React, '.tsx');

    expect(tsx).toContain('max-[391px]:flex-col');
    expect(tsx).toContain('max-[391px]:hidden');
  });

  it('Svelte: overrides become a media query in the component style', () => {
    expect(file(phoneStacked(), CodeTarget.Svelte, '.svelte')).toContain('@media (max-width: 390px)');
  });

  it('a smaller view only states what changed since the larger one', () => {
    const tablet = must(addBreakpoint(phoneStacked(), BreakpointPreset.Tablet, 'tab'));
    const doc = must(setOverride(tablet, 'tab', 'row', OverrideKey.Direction, Direction.Vertical));
    const css = file(doc, CodeTarget.Html, 'page.css');
    const queried = [...css.matchAll(/@media \(max-width: (\d+)px\) \{\s+\.([a-z-]+) \{\s+([^}]+)\}/g)].map((m) => [m[1], m[2], m[3].trim()]).filter(([, , rules]) => !rules.startsWith('flex-wrap'));

    expect(queried).toEqual([
      ['810', 'row', 'flex-direction: column;'],
      ['390', 'aside', 'display: none;']
    ]);
  });
});

describe('view-only layers', () => {
  it('stay in the markup, hidden at base and shown in their view', () => {
    const html = file(viewOnlyDoc(), CodeTarget.Html, 'index.html');
    const css = file(viewOnlyDoc(), CodeTarget.Html, 'page.css');

    expect(html).toContain('class="promo"');
    expect(html).toContain('Phone only');
    expect(css).toMatch(/\.promo \{[^}]*display: none;/);
    expect(css).toMatch(/@media \(max-width: 390px\) \{\s+\.promo \{\s+display: flex;/);
  });

  it('a layer that has no display of its own is restored with revert, never unset', () => {
    const css = file(viewOnlyDoc(), CodeTarget.Html, 'page.css');

    expect(css).toMatch(/@media \(max-width: 390px\) \{\s+\.tip \{[^}]*display: revert;/);
    expect(css).not.toContain('display: unset');
  });

  it('React: the layer is hidden by default and shown by its variant', () => {
    const tsx = file(viewOnlyDoc(), CodeTarget.React, '.tsx');

    expect(tsx).toContain('Phone only');
    expect(tsx).toMatch(/hidden[^"]*max-\[391px\]:flex/);
  });
});

describe('overrides inside a component main', () => {
  it('reach every instance through a media query on the main', () => {
    const doc = compMainDoc();
    const css = file(doc, CodeTarget.Html, 'button.css') + file(doc, CodeTarget.Html, 'page.css');

    expect(css).toMatch(/@media \(max-width: 390px\) \{\s+\.button \{\s+padding-block: 4px;/);
  });
});

describe('overrides on the exported frame itself', () => {
  it('reach a media query on the page root, which keeps its own width rules', () => {
    const kit = new DocKit(1200, 400);
    kit.frame('only', { name: 'Only', box: box(0, 0, 1200, 400), layout: { direction: Direction.Horizontal }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
    kit.text('a', 'A', { parent: 'only', name: 'A', size: 20, font: 'Inter' });
    const doc = must(setOverride(withViews(kit.doc(), PHONE), 'phone', 'only', OverrideKey.Direction, Direction.Vertical));
    const css = file(doc, CodeTarget.Html, 'page.css');

    expect(css).toMatch(/@media \(max-width: 390px\) \{\s+\.page \{\s+flex-direction: column;[^}]*\}/);
    expect(css).not.toMatch(/@media[^}]*max-width: unset/);
  });
});

describe('rows between breakpoints', () => {
  const rule = (css: string, width: number) => css.match(new RegExp(`@media \\(max-width: ${width}px\\) \\{\\s+\\.lane \\{\\s+([^}]+)\\}`))?.[1].trim();

  function lane() {
    const kit = new DocKit(1440, 900);
    kit.frame('page', { name: 'Page', box: box(0, 0, 1440, 900), layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
    kit.frame('lane', { name: 'Lane', parent: 'page', box: box(0, 0, 1440, 100), layout: { direction: Direction.Horizontal, gap: 8 }, item: { width: Sizing.Fill, height: Sizing.Hug } });
    kit.text('a', 'A', { parent: 'lane', name: 'A', size: 20, font: 'Inter' });
    return withViews(kit.doc(), TABLET, PHONE);
  }

  it('do not wrap at a defined view width, as the canvas does not', () => {
    const css = file(lane(), CodeTarget.Html, 'page.css');

    expect(css).not.toMatch(/^\.lane \{[^}]*flex-wrap/m);
    expect(rule(css, 810)).toBe('flex-wrap: nowrap;');
    expect(rule(css, 390)).toBe('flex-wrap: nowrap;');
  });

  it('wrap strictly between and below the defined view widths', () => {
    const css = file(lane(), CodeTarget.Html, 'page.css');

    expect(rule(css, 1439)).toBe('flex-wrap: wrap;');
    expect(rule(css, 809)).toBe('flex-wrap: wrap;');
    expect(rule(css, 389)).toBe('flex-wrap: wrap;');
  });
});

describe('the page height per view', () => {
  it('follows each view, not the base frame', () => {
    const css = file(tallViewsDoc(), CodeTarget.Html, 'page.css');

    expect(css).toMatch(/^\.page \{[^}]*min-height: 1600px;/m);
    expect(css).toMatch(/@media \(max-width: 390px\) \{\s+\.page \{\s+min-height: 900px;/);
  });
});

describe('padding that changes shape between views', () => {
  it('does not reset a side that the new shorthand already sets', () => {
    const kit = new DocKit(1280, 600);
    const pad = (top: number, right: number, bottom: number, left: number) => ({ top, right, bottom, left });
    kit.frame('page', { name: 'Page', box: box(0, 0, 1280, 600), layout: { direction: Direction.Vertical, padding: pad(10, 20, 30, 40) }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
    kit.text('a', 'A', { parent: 'page', name: 'A', size: 20, font: 'Inter' });
    const doc = must(setOverride(withViews(kit.doc(), PHONE), 'phone', 'page', OverrideKey.Padding, pad(14, 20, 14, 20)));
    const css = file(doc, CodeTarget.Html, 'page.css');
    const phone = css.slice(css.indexOf('@media (max-width: 390px)'));

    expect(phone).toContain('padding-block: 14px;');
    expect(phone).not.toMatch(/padding-(top|right|bottom|left): unset/);
  });
});
