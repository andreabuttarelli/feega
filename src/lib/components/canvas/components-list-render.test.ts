import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ComponentsList from './ComponentsList.svelte';
import type { ProjectComponent } from '$lib/canvas/project-components';

const button: ProjectComponent = {
  key: 'f1:b',
  frameId: 'f1',
  home: 'f1',
  name: 'Button',
  thumb: '/p/p/c/c1/assets/poster',
  frameName: 'Landing',
  revision: 4,
  variants: [
    { compId: 'b', variant: { State: 'Default' } },
    { compId: 'bh', variant: { State: 'Hover' } }
  ]
};

const body = () => render(ComponentsList, { props: { groups: [button], title: 'Home', projectId: 'p', canvasId: 'c1' } }).body;

describe('the components grid', () => {
  it('shows a tile per variant, each draggable and named under its preview', () => {
    const html = body();

    expect(html.match(/data-testid="component-row"/g)?.length).toBe(2);
    expect(html.match(/draggable="true"/g)?.length).toBe(2);
    expect(html).toContain('Button');
    expect(html).toContain('Hover');
  });

  it('previews the component itself, never the poster of its frame', () => {
    const html = body();

    expect(html.match(/data-testid="component-preview"/g)?.length).toBe(2);
    expect(html).not.toContain('assets/poster');
  });

  it('keeps show main and copy on every tile', () => {
    const html = body();

    expect(html.match(/data-testid="component-show-main"/g)?.length).toBe(2);
    expect(html.match(/data-testid="component-copy"/g)?.length).toBe(2);
  });
});
