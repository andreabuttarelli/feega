import { describe, expect, it } from 'vitest';
import { Direction, Sizing } from '../layout/auto-layout';
import type { MotionDoc } from '../doc';
import { addBreakpoint, BreakpointPreset, OverrideKey, setOverride } from '../breakpoints/model';
import { CodeTarget, exportCode } from './index';
import { box, DocKit } from './fixtures/kit';

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

  it('React: overrides become max-[390px] variants', () => {
    const tsx = file(phoneStacked(), CodeTarget.React, '.tsx');

    expect(tsx).toContain('max-[390px]:flex-col');
    expect(tsx).toContain('max-[390px]:hidden');
  });

  it('Svelte: overrides become a media query in the component style', () => {
    expect(file(phoneStacked(), CodeTarget.Svelte, '.svelte')).toContain('@media (max-width: 390px)');
  });

  it('a smaller view only states what changed since the larger one', () => {
    const tablet = must(addBreakpoint(phoneStacked(), BreakpointPreset.Tablet, 'tab'));
    const doc = must(setOverride(tablet, 'tab', 'row', OverrideKey.Direction, Direction.Vertical));
    const css = file(doc, CodeTarget.Html, 'page.css');
    const queried = [...css.matchAll(/@media \(max-width: (\d+)px\) \{\s+\.([a-z-]+) \{\s+([^}]+)\}/g)].map((m) => [m[1], m[2], m[3].trim()]);

    expect(queried).toEqual([
      ['810', 'row', 'flex-direction: column;'],
      ['390', 'aside', 'display: none;']
    ]);
  });
});
