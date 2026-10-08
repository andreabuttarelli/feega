import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import MenuDrawer from './MenuDrawer.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { SaveState } from '$lib/motion/editor-bar';

const EDITOR_PAGE = 'src/routes/p/[projectId]/c/[canvasId]/motion/[nodeId]/+page.svelte';
const noop = () => {};

const html = () =>
  render(MenuDrawer, {
    props: {
      canvasHref: '/p/1/c/2',
      canvasName: 'Launch',
      crumbs: [
        { name: 'Teaser', go: noop },
        { name: 'Intro', go: null }
      ],
      doc: newMotionDoc(MotionFormat.Landscape),
      onchange: noop,
      saveState: SaveState.Saved,
      version: 7,
      ontemplate: noop,
      onhelp: noop,
      onclose: noop
    }
  }).body;

describe('menu drawer', () => {
  it('is a modal dialog holding the canvas info the top bar used to carry', () => {
    const body = html();

    expect(body).toMatch(/role="dialog"[^>]*aria-modal="true"/);
    expect(body).toContain('href="/p/1/c/2"');
    expect(body).toContain('data-testid="comp-breadcrumb"');
    expect(body).toContain('Intro');
    expect(body).toContain('data-testid="fit-duration"');
    expect(body).toMatch(/data-testid="save-state"[^>]*>[\s\S]*Saved · v7/);
  });

  it('holds Template and Keyboard & gestures', () => {
    const body = html();

    expect(body).toContain('data-testid="template-open"');
    expect(body).toContain('data-testid="guide-open-menu"');
  });
});

describe('editor top bar', () => {
  const page = readFileSync(EDITOR_PAGE, 'utf8');
  const bar = page.slice(page.indexOf('<header class="bar">'), page.indexOf('</header>'));

  it('opens the drawer from a Menu button, first in the bar', () => {
    expect(bar.indexOf('action={Action.Menu}')).toBeGreaterThan(-1);
    expect(bar.indexOf('action={Action.Menu}')).toBeLessThan(bar.indexOf('class="group transport"'));
  });

  it('no longer carries what moved into the drawer', () => {
    for (const id of ['template-open', 'save-state', 'comp-settings', 'guide-open-menu', 'comp-breadcrumb']) {
      expect(bar, id).not.toContain(`data-testid="${id}"`);
    }
  });
});
