import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Model3dViewer from './Model3dViewer.svelte';

const routes = join(dirname(fileURLToPath(import.meta.url)), '../../../routes');
const page = readFileSync(join(routes, 'p/[projectId]/c/[canvasId]/+page.svelte'), 'utf8');
const sharedPage = readFileSync(join(routes, 's/[token]/+page.svelte'), 'utf8');

function html(props: Record<string, unknown>): string {
  return render(Model3dViewer, { props: { src: '/assets/m', nodeId: 'abcdef12', ...props } }).body;
}

describe('the 3D model viewer', () => {
  it('shows the poster first and loads no 3D engine on the server', () => {
    const body = html({ poster: '/assets/p' });

    expect(body).toContain('data-testid="model3d-viewer"');
    expect(body).toContain('src="/assets/p"');
    expect(body).not.toContain('<canvas');
  });

  it('without a poster shows a placeholder, not a broken image', () => {
    const body = html({ poster: null });

    expect(body).not.toContain('<img');
    expect(body).toContain('data-testid="model3d-placeholder"');
  });

  it('offers the GLB download and the auto-rotate toggle', () => {
    const body = html({ poster: null });

    expect(body).toContain('aria-label="Download"');
    expect(body).toContain('aria-label="Auto-rotate"');
  });

  it('offers Render views only where someone can receive them', () => {
    expect(html({ poster: null })).not.toContain('Render views');
    expect(html({ poster: null, onrender: () => {} })).toContain('Render views');
  });

  it('the canvas draws it for every 3D node, with the render views wired', () => {
    expect(page).toMatch(/<Model3dViewer[^>]*src=\{`\/p\/\$\{data\.projectId\}\/c\/\$\{data\.canvas\.id\}\/assets\/\$\{refId\}`\}[^>]*onrender=/s);
  });

  it('the shared canvas draws it too', () => {
    expect(sharedPage).toMatch(/<Model3dViewer[^>]*src=\{node\.view\.url\}[^>]*poster=\{node\.view\.poster\}/s);
  });
});
