import { describe, expect, it } from 'vitest';
import { Direction, Sizing } from '../layout/auto-layout';
import type { MotionDoc } from '../doc';
import { addBreakpoint, BreakpointPreset, OverrideKey, setOverride } from '../breakpoints/model';
import { CodeTarget, exportCode, type CodeExport } from './index';
import { box, DocKit } from './fixtures/kit';

const SIGNED = 'https://x.supabase.co/storage/v1/object/sign/canvas-assets/o/p/hero.png?token=abc';

const must = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const file = (out: CodeExport, suffix: string) =>
  out.files
    .filter((f) => f.path.endsWith(suffix))
    .map((f) => f.content)
    .join('\n');

const block = (css: string, name: string) => css.match(new RegExp(`\\.${name} \\{([^}]*)\\}`))?.[1] ?? '';

function stackedPage(): MotionDoc {
  const kit = new DocKit(1440, 1200);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1440, 1200), fill: '#ffffff' });
  kit.frame('header', { name: 'Top', parent: 'page', box: box(0, 0, 1440, 80), fill: '#000000' });
  kit.frame('hero', { name: 'Hero', parent: 'page', box: box(120, 160, 1200, 600), fill: '#eeeeee' });
  kit.text('caption', 'Ship faster', { parent: 'page', name: 'Caption', size: 18, box: box(120, 800, 200, 30) });
  return kit.doc();
}

function rowPage(): MotionDoc {
  const kit = new DocKit(1440, 900);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1440, 900), fill: '#ffffff', layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.frame('row', { name: 'Row', parent: 'page', box: box(0, 0, 1440, 400), layout: { direction: Direction.Horizontal, gap: 32 }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.image('shot', 'asset-1', { parent: 'row', name: 'Shot', box: box(0, 0, 640, 400), item: { width: Sizing.Fixed, height: Sizing.Fixed } });
  kit.text('lead', 'Lead', { parent: 'row', name: 'Lead', size: 48 });
  const phone = must(addBreakpoint(kit.doc(), BreakpointPreset.Phone, 'ph'));
  return must(setOverride(phone, 'ph', 'row', OverrideKey.Direction, Direction.Vertical));
}

describe('responsive code export', () => {
  it('a frame wider than a phone fills its parent up to its design width instead of a fixed width', () => {
    const css = file(exportCode(stackedPage(), { target: CodeTarget.Html, name: 'Page' }), 'page.css');

    expect(block(css, 'hero')).not.toMatch(/(^|\s)width: 1200px;/);
    expect(block(css, 'hero')).toContain('max-width: 1200px;');
  });

  it('layers that stack top to bottom flow in a column instead of being positioned absolutely', () => {
    const css = file(exportCode(stackedPage(), { target: CodeTarget.Html, name: 'Page' }), 'page.css');

    expect(block(css, 'page')).toContain('flex-direction: column;');
    expect(block(css, 'hero')).not.toContain('position: absolute;');
    expect(block(css, 'hero')).toContain('margin-top: 80px;');
    expect(block(css, 'hero')).toContain('margin-left: 120px;');
    expect(block(css, 'caption')).toContain('margin-top: 40px;');
    expect(block(css, 'caption')).toContain('width: 200px;');
  });

  it('React: the root is fluid and the stacked layers carry no absolute classes', () => {
    const tsx = file(exportCode(stackedPage(), { name: 'Page' }), 'pages/Page.tsx');

    expect(tsx).toContain('w-full');
    expect(tsx).not.toContain('w-[1440px]');
    expect(tsx).not.toContain('w-[1200px]');
    expect(tsx).not.toMatch(/className="[^"]*absolute[^"]*"/);
  });

  it('a phone override on an auto-layout row becomes a breakpoint class on the same markup', () => {
    const tsx = file(exportCode(rowPage(), { name: 'Page' }), 'pages/Page.tsx');

    expect(tsx).toMatch(/className="[^"]*\bflex\b[^"]*max-\[390px\]:flex-col/);
  });

  it('an image points at a file bundled in the project, not at the signed link', () => {
    const out = exportCode(rowPage(), { name: 'Page', assets: { 'asset-1': SIGNED } });

    expect(file(out, 'pages/Page.tsx')).toContain('src="/assets/asset-1.png"');
    expect(file(out, 'pages/Page.tsx')).not.toContain('token=');
    expect(out.assets).toEqual([{ path: 'public/assets/asset-1.png', ref: '/assets/asset-1.png', url: SIGNED }]);
  });

  it('static HTML references the bundled image relatively', () => {
    const out = exportCode(rowPage(), { target: CodeTarget.Html, name: 'Page', assets: { 'asset-1': SIGNED } });

    expect(file(out, 'index.html')).toContain('src="assets/asset-1.png"');
    expect(out.assets).toEqual([{ path: 'assets/asset-1.png', ref: 'assets/asset-1.png', url: SIGNED }]);
  });
});
