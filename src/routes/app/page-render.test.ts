import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const motion = { id: 'm1', name: 'acme.com', projectName: 'Launch', updatedAt: '2026-10-03', poster: null, href: '/p/p1/c/c1/motion/m1' };
const project = { id: 'p1', name: 'Launch', href: '/p/p1', updatedAt: '2026-10-03', canvases: [], thumbs: [] };
const card = { id: 'g1', title: 'Gallery film', authorName: 'Feega', kind: 'motion', format: 'landscape', durationS: 8, tags: [], posterUrl: null, previewUrl: null, remixCount: 0, remixedFrom: null };

function page(motions: (typeof motion)[] = [motion]) {
  const data = { dashboard: { projects: [project], batches: [], motions }, gallery: [card], templates: [{ id: 't', name: 'Logo reveal', brief: 'A logo reveal' }], tools: [] };
  return render(Page, { props: { data, form: null } as never }).body;
}

describe('the /app dashboard puts the one input before everything', () => {
  it('reads input, then recent videos, then the gallery, then projects', () => {
    const body = page();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('data-testid="video-brief"')).toBeGreaterThan(-1);
    expect(at('data-testid="video-brief"')).toBeLessThan(at('data-testid="home-videos"'));
    expect(at('data-testid="home-videos"')).toBeLessThan(at('data-testid="home-gallery"'));
    expect(at('data-testid="home-gallery"')).toBeLessThan(at('data-testid="home-projects"'));
  });

  it('a new user sees the same input, titled make a video', () => {
    const body = page([]);

    expect(body).toContain('make a video.');
    expect(body).toContain('placeholder="Your website or what you want to make"');
    expect(body).not.toContain('data-testid="home-videos"');
  });
});
