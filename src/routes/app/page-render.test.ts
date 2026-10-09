import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

const motion = { id: 'm1', name: 'acme.com', projectName: 'Launch', updatedAt: '2026-10-03', poster: null, href: '/p/p1/c/c1/motion/m1' };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [] };
const card = { id: 'g1', title: 'Gallery film', authorName: 'Feega', kind: 'motion', format: 'landscape', durationS: 8, tags: [], posterUrl: null, previewUrl: null, remixCount: 0, remixedFrom: null };
const PLACEHOLDER = 'Paste your website or describe the video you want…';

function page(motions: (typeof motion)[] = [motion]) {
  const data = { dashboard: { projects: [project], batches: [], motions }, gallery: [card], templates: [{ id: 't', name: 'Logo reveal', brief: 'A logo reveal' }], tools: [], attachProjectId: 'p1' };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app dashboard puts the one prompt before everything', () => {
  it('reads prompt, then recent videos, then the gallery, then projects', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="video-brief"')).toBeGreaterThan(-1);
    expect(at('data-testid="video-brief"')).toBeLessThan(at('data-testid="home-videos"'));
    expect(at('data-testid="home-videos"')).toBeLessThan(at('data-testid="home-gallery"'));
    expect(at('data-testid="home-gallery"')).toBeLessThan(at('data-testid="home-projects"'));
  });

  it('the hero holds title, composer, examples and helper, in that order', () => {
    const body = page();
    const hero = body.slice(body.indexOf('data-testid="home-hero"'), body.indexOf('data-testid="home-videos"'));
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
    expect(body).not.toContain('data-testid="home-videos"');
  });

  it('an example chip is a button that fills, not a form submit', () => {
    const body = page();

    expect(body).toMatch(/<button type="button"[^>]*data-brief="A logo reveal"/);
  });
});
