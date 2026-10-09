import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const motion = { id: 'm1', name: 'acme.com', projectName: 'Launch', updatedAt: '2026-10-03', format: '9:16', poster: 'https://signed/poster.jpg', preview: null, href: '/p/p1/c/c1/motion/m1' };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [], videoCount: 1, posters: ['https://signed/poster.jpg'] };
const card = { id: 'g1', title: 'Gallery film', authorName: 'Feega', kind: 'motion', format: 'landscape', durationS: 8, tags: [], posterUrl: null, previewUrl: null, remixCount: 0, remixedFrom: null };
const PLACEHOLDER = 'Paste your website or describe the video you want…';

function page(motions: (typeof motion)[] = [motion], projects: (typeof project)[] = [project], moreVideos: string | null = null) {
  const data = { dashboard: { projects, batches: [], motions, moreVideos }, gallery: [card], templates: [{ id: 't', name: 'Logo reveal', brief: 'A logo reveal' }], tools: [], attachProjectId: 'p1' };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app dashboard puts the one prompt before everything', () => {
  it('reads prompt, then the videos grid, then the projects grid, then the gallery row', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="video-brief"')).toBeGreaterThan(-1);
    expect(at('data-testid="video-brief"')).toBeLessThan(at('data-testid="home-videos"'));
    expect(at('data-testid="home-videos"')).toBeLessThan(at('data-testid="home-projects"'));
    expect(at('data-testid="home-projects"')).toBeLessThan(at('data-testid="home-gallery"'));
  });

  it('the hero points down at the videos', () => {
    const body = page();
    expect(body.indexOf('data-testid="home-peek"')).toBeLessThan(body.indexOf('data-testid="home-videos"'));
    expect(body).toMatch(/href="#videos-heading"[^>]*data-testid="home-peek"|data-testid="home-peek"[^>]*href="#videos-heading"/);
  });

  it('a video card has a sized lazy poster, its project, its format and opens the editor', () => {
    const body = page();
    const card = body.slice(body.indexOf('data-testid="home-videos"'), body.indexOf('data-testid="home-projects"'));

    expect(card).toContain('href="/p/p1/c/c1/motion/m1"');
    expect(card).toMatch(/<img src="https:\/\/signed\/poster.jpg"[^>]*loading="lazy"[^>]*width="\d+" height="\d+"/);
    expect(card).toContain('Launch');
    expect(card).toContain('title="9:16"');
  });

  it('a project card shows its posters, its video count and opens the project', () => {
    const body = page();
    const grid = body.slice(body.indexOf('data-testid="home-projects"'));

    expect(grid).toContain('href="/p/p1"');
    expect(grid).toContain('1 video');
    expect(grid).toContain('https://signed/poster.jpg');
    expect(body).toContain('data-testid="new-project"');
  });

  it('offers more videos only when the server said there are', () => {
    expect(page()).not.toContain('data-testid="more-videos"');
    expect(page([motion], [project], '2026-10-01')).toContain('data-testid="more-videos"');
  });

  it('with nothing made yet, both grids say so gently and the prompt stays the way in', () => {
    const body = page([], []);

    expect(body).toContain('data-testid="home-videos-empty"');
    expect(body).toContain('data-testid="home-projects-empty"');
    expect(body).toContain('href="#video-brief"');
  });

  it('the hero holds title, composer, examples and helper, in that order', () => {
    const body = page();
    const hero = body.slice(body.indexOf('data-testid="home-hero"'), body.indexOf('data-testid="home-peek"'));
    const at = (needle: string) => hero.indexOf(needle);

    expect(at('make a video.')).toBeGreaterThan(-1);
    expect(at('make a video.')).toBeLessThan(at('data-testid="video-brief"'));
    expect(at('data-testid="video-brief"')).toBeLessThan(at('data-testid="chat-attach"'));
    expect(at('data-testid="chat-attach"')).toBeLessThan(at('data-testid="brief-send"'));
    expect(at('data-testid="brief-send"')).toBeLessThan(at('data-testid="brief-examples"'));
    expect(at('data-testid="brief-examples"')).toBeLessThan(at('data-testid="brief-helper"'));
  });

  it('the prompt is a multi-line textarea that reads as a prompt', () => {
    const body = page([]);

    expect(body).toMatch(/<textarea[^>]*data-testid="video-brief"/);
    expect(body).toContain(`placeholder="${PLACEHOLDER}"`);
  });

  it('an example chip is a button that fills, not a form submit', () => {
    const body = page();

    expect(body).toMatch(/<button type="button"[^>]*data-brief="A logo reveal"/);
  });
});
