import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const canvas = { id: 'c1', name: 'Spring teaser', projectName: 'Launch', updatedAt: '2026-10-03', href: '/p/p1/c/c1', thumbs: ['https://signed/poster.jpg'] };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [], videoCount: 1, posters: ['https://signed/poster.jpg'] };
const PLACEHOLDER = 'Describe what you want to make, or paste your website…';

function page(canvases: (typeof canvas)[] = [canvas]) {
  const data = { dashboard: { canvases, projects: [project], batches: [], motions: [], moreVideos: null }, templates: [{ id: 't', name: 'A poster series', brief: 'A poster series' }], tools: [], attachProjectId: 'p1' };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app home: the recents, one prompt', () => {
  it('reads create actions, recents, then the prompt', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="home-create"')).toBeGreaterThan(-1);
    expect(at('data-testid="home-create"')).toBeLessThan(at('data-testid="home-recents"'));
    expect(at('data-testid="home-recents"')).toBeLessThan(at('data-testid="video-brief"'));
  });

  it('has no hero box: create actions lead straight to the recents', () => {
    const body = page();

    expect(body).not.toContain('data-testid="home-hero"');
    expect(body).not.toContain('design that moves.');
  });

  it('creates only a new canvas and imports: no catalogue rows on the home', () => {
    const body = page();
    const create = body.slice(body.indexOf('data-testid="home-create"'), body.indexOf('data-testid="home-scroll"'));

    expect(create).toContain('action="?/project"');
    expect(create).toContain('data-testid="new-canvas"');
    expect(create).toContain('data-testid="home-import"');
    expect(body).not.toContain('home-components');
    expect(body).not.toContain('home-posters');
    expect(body).not.toContain('home-gallery');
  });

  it('a recent is a canvas: a sized lazy thumbnail, its name, its project, and it opens the canvas', () => {
    const body = page();
    const recents = body.slice(body.indexOf('data-testid="home-recents"'), body.indexOf('data-testid="video-brief"'));

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

  it('a new user sees an empty state that points at the prompt and the new canvas', () => {
    const body = page([]);

    expect(body).toContain('data-testid="home-empty"');
    expect(body).not.toContain('data-testid="home-recents"');
    expect(body).toContain('href="#video-brief"');
  });

  it('the prompt sends to the video action, with three suggestions above it', () => {
    const body = page();
    const chips = body.slice(body.indexOf('data-testid="brief-examples"'), body.indexOf('data-testid="video-brief"'));

    expect(body).toMatch(/<form[^>]*action="\?\/video"/);
    expect(body).toMatch(/<textarea[^>]*data-testid="video-brief"/);
    expect(body).toContain(`placeholder="${PLACEHOLDER}"`);
    expect(chips).toMatch(/<button type="button"[^>]*data-brief="A poster series"/);
    expect(body.indexOf('data-testid="video-brief"')).toBeLessThan(body.indexOf('data-testid="brief-send"'));
  });
});
