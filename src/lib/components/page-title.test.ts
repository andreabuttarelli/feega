import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PageTitle from './PageTitle.svelte';
import { TitleSize } from './page-title';

const VIEWS = [
  'src/routes/app/+page.svelte',
  'src/routes/gallery/+page.svelte',
  'src/routes/gallery/[id]/+page.svelte',
  'src/routes/app/motion/+page.svelte',
  'src/routes/app/compose/+page.svelte',
  'src/routes/app/studio/+page.svelte',
  'src/routes/app/studio/[batchId]/+page.svelte',
  'src/routes/app/upscale/+page.svelte',
  'src/routes/app/api-keys/+page.svelte',
  'src/routes/p/[projectId]/settings/+layout.svelte',
  'src/routes/login/+page.svelte'
];

describe('titolo di vista in mega type', () => {
  it.each(VIEWS)('%s usa PageTitle e nessun h1 scritto a mano', (path) => {
    const source = readFileSync(path, 'utf8');

    expect(source).toContain('<PageTitle ');
    expect(source).not.toMatch(/<h1[\s>]/);
  });

  it('scrive il titolo minuscolo nel testo, prima lettera compresa', () => {
    const { body } = render(PageTitle, { props: { text: 'Create a Video' } });

    expect(body).toContain('>create a video</h1>');
  });

  it('il login è l\'unica vista col titolo piccolo', () => {
    const source = readFileSync('src/routes/login/+page.svelte', 'utf8');
    const titles = source.match(/<PageTitle [^>]*>/g) ?? [];

    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((t) => t.includes('size={TitleSize.Small}'))).toBe(true);
  });

  it('il titolo piccolo non usa la mega type', () => {
    const { body } = render(PageTitle, { props: { text: 'Sign in', size: TitleSize.Small } });

    expect(body).toContain('small');
  });
});
