import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const motion = { id: 'm1', name: 'acme.com', projectName: 'Launch', updatedAt: '2026-10-03', format: '9:16', poster: 'https://signed/poster.jpg', preview: null, href: '/p/p1/c/c1/motion/m1' };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [], videoCount: 1, posters: ['https://signed/poster.jpg'] };
const PLACEHOLDER = 'Describe what you want to make, or paste your website…';

function page(motions: (typeof motion)[] = [motion], moreVideos: string | null = null, name: string | null = 'Andrea') {
  const data = { dashboard: { projects: [project], batches: [], motions, moreVideos }, templates: [{ id: 't', name: 'Logo reveal', brief: 'A logo reveal' }], tools: [], attachProjectId: 'p1', profile: { name, email: 'a@b.c', avatarUrl: null } };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app home: a hero, the recents, one prompt', () => {
  it('reads create actions, greeting, recents, then the prompt', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="home-create"')).toBeGreaterThan(-1);
    expect(at('data-testid="home-create"')).toBeLessThan(at('data-page-title'));
    expect(at('data-page-title')).toBeLessThan(at('data-testid="home-recents"'));
    expect(at('data-testid="home-recents"')).toBeLessThan(at('data-testid="video-brief"'));
  });

  it('the hero says the slogan and the subline, over a still poster that never waits on video', () => {
    const body = page();
    const hero = body.slice(body.indexOf('data-testid="home-hero"'), body.indexOf('data-testid="home-recents"'));

    expect(hero).toContain('design that moves.');
    expect(hero).toContain('an ai canvas for interaction design');
    expect(hero).toContain('src="/home/hero-flow.jpg"');
    expect(hero).not.toContain('<video');
  });

  it('creates only a new canvas and imports: no catalogue rows on the home', () => {
    const body = page();
    const create = body.slice(body.indexOf('data-testid="home-create"'), body.indexOf('data-page-title'));

    expect(create).toContain('action="?/project"');
    expect(create).toContain('data-testid="new-canvas"');
    expect(create).toContain('data-testid="home-import"');
    expect(body).not.toContain('home-components');
    expect(body).not.toContain('home-posters');
    expect(body).not.toContain('home-gallery');
  });

  it('a recent row has a sized lazy thumbnail, its name, its project and opens the editor', () => {
    const body = page();
    const recents = body.slice(body.indexOf('data-testid="home-recents"'), body.indexOf('data-testid="video-brief"'));

    expect(recents).toContain('href="/p/p1/c/c1/motion/m1"');
    expect(recents).toMatch(/<img src="https:\/\/signed\/poster.jpg"[^>]*loading="lazy"[^>]*width="\d+" height="\d+"/);
    expect(recents).toContain('acme.com');
    expect(recents).toContain('Launch');
  });

  it('offers more recents only when the server said there are', () => {
    expect(page()).not.toContain('data-testid="more-videos"');
    expect(page([motion], '2026-10-01')).toContain('data-testid="more-videos"');
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
    expect(chips).toMatch(/<button type="button"[^>]*data-brief="A logo reveal"/);
    expect(body.indexOf('data-testid="video-brief"')).toBeLessThan(body.indexOf('data-testid="brief-send"'));
  });
});
