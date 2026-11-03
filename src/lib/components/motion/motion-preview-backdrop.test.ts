import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { compile } from 'svelte/compiler';
import MotionPreview from './MotionPreview.svelte';
import { Background, MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { RenderEngine } from '$lib/motion/gpu/engine-flag';

const body = (background?: Background) => render(MotionPreview, { props: { html: '<div></div>', width: 100, height: 100, ...(background ? { background } : {}) } }).body;

describe('the player behind a see-through picture', () => {
  it('lets the canvas show through a transparent doc, instead of painting black behind it', () => {
    expect(body(Background.Transparent)).toContain('data-backdrop="transparent"');
  });

  it('draws no outline around a transparent doc, which on the canvas reads as a seam inside the element', () => {
    const source = readFileSync(new URL('./MotionPreview.svelte', import.meta.url), 'utf8');
    const css = compile(source, { css: 'external', filename: 'MotionPreview.svelte' }).css?.code ?? '';
    const seeThrough = css.match(/\.stage[^{,]*\[data-backdrop='transparent'\][^{,]*\{([^}]*)\}/)?.[1] ?? '';

    expect(seeThrough).toMatch(/outline:\s*none/);
  });

  it('keeps its dark backdrop for a branded doc', () => {
    expect(body(Background.Brand)).toContain('data-backdrop="brand"');
    expect(body()).toContain('data-backdrop="brand"');
  });
});

const FULL = { doc: newMotionDoc(MotionFormat.Landscape), tokens: FEEGA_TOKENS, assets: {} };

describe('the engine a preview draws with', () => {
  it('draws with gpu-core once it has the document to draw', () => {
    const out = render(MotionPreview, { props: { html: '<div></div>', width: 100, height: 100, fullDoc: FULL } }).body;
    expect(out).toContain('data-engine="gpu-core"');
    expect(out).toContain('gpu-full-reads');
  });

  it('stays on the HTML player when it only has HTML', () => {
    const out = body();
    expect(out).toContain('data-engine="html"');
    expect(out).not.toContain('gpu-full-reads');
  });

  it('honours the HTML kill switch even with a document', () => {
    const out = render(MotionPreview, { props: { html: '<div></div>', width: 100, height: 100, fullDoc: FULL, engine: RenderEngine.Html } }).body;
    expect(out).toContain('data-engine="html"');
  });
});
