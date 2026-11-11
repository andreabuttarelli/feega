import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const canvas = { id: 'c1', name: 'Spring teaser', projectName: 'Launch', updatedAt: '2026-10-03', href: '/p/p1/c/c1', thumbs: ['https://signed/poster.jpg'] };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [], videoCount: 1, posters: ['https://signed/poster.jpg'] };

function page(canvases: (typeof canvas)[] = [canvas], projects: { id: string; name: string }[] = []) {
  const data = { projects, dashboard: { canvases, projects: [project], batches: [], motions: [], moreVideos: null }, tools: [] };
  return render(Page, { props: { data } as never }).body;
}

describe('the /app home: the recents', () => {
  it('a new canvas can be started in one of the existing projects', () => {
    const body = page([canvas], [{ id: 'p1', name: 'Launch' }]);

    expect(body).toContain('data-testid="new-canvas-project"');
    expect(body).toContain('name="projectId"');
  });

  it('reads create actions, then recents', () => {
    const body = page();

    expect(body.indexOf('data-testid="home-create"')).toBeGreaterThan(-1);
    expect(body.indexOf('data-testid="home-create"')).toBeLessThan(body.indexOf('data-testid="home-recents"'));
  });

  it('has no prompt box', () => {
    const body = page();

    expect(body).not.toContain('<textarea');
    expect(body).not.toContain('video-brief');
    expect(body).not.toContain('action="?/video"');
  });

  it('has no hero box: create actions lead straight to the recents', () => {
    const body = page();

    expect(body).not.toContain('data-testid="home-hero"');
    expect(body).not.toContain('design that moves.');
  });

  it('creates only a new canvas and a .feega import: no catalogue rows on the home', () => {
    const body = page();
    const create = body.slice(body.indexOf('data-testid="home-create"'), body.indexOf('data-testid="home-scroll"'));

    expect(create).toContain('action="?/project"');
    expect(create).toContain('data-testid="new-canvas"');
    expect(create).toContain('data-testid="home-import-feega"');
    expect(body).not.toContain('home-components');
    expect(body).not.toContain('home-posters');
    expect(body).not.toContain('home-gallery');
  });

  it('a recent is a canvas: a sized lazy thumbnail, its name, its project, and it opens the canvas', () => {
    const body = page();
    const recents = body.slice(body.indexOf('data-testid="home-recents"'), body.length);

    expect(recents).toContain('href="/p/p1/c/c1"');
    expect(recents).toMatch(/<img src="https:\/\/signed\/poster.jpg"[^>]*loading="lazy"[^>]*width="\d+" height="\d+"/);
    expect(recents).toContain('Spring teaser');
    expect(recents).toContain('Launch');
  });

  it('a canvas with several frames shows them side by side; one with none shows its initial', () => {
    const many = page([{ ...canvas, thumbs: ['https://signed/a.jpg', 'https://signed/b.jpg'] }]);
    const none = page([{ ...canvas, thumbs: [] }]);

    expect(many).toContain('https://signed/b.jpg');
    expect(none).toMatch(/class="initial[^"]*"[^>]*>s</);
  });

  it('a new user sees an empty state that points at the new canvas', () => {
    const body = page([]);

    expect(body).toContain('data-testid="home-empty"');
    expect(body).not.toContain('data-testid="home-recents"');
  });
});
