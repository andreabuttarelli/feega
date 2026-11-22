import { existsSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates/library';
import { Tier } from '../templates/template';
import TemplatesTeaser from './TemplatesTeaser.svelte';
import { TEASER_CTA, teaserShots, teaserTitle } from './templates-teaser';

const MIN_SHOTS = 4;
const MAX_SHOTS = 6;

const freeCount = TEMPLATES.filter((t) => t.tier === Tier.Free).length;

describe('home templates teaser', () => {
  it('shows four to six thumbnails that exist on disk', () => {
    const shots = teaserShots();

    expect(shots.length).toBeGreaterThanOrEqual(MIN_SHOTS);
    expect(shots.length).toBeLessThanOrEqual(MAX_SHOTS);
    expect(shots.every((shot) => existsSync(`static${shot.src}`))).toBe(true);
  });

  it('counts the free templates from the library, not from a literal', () => {
    expect(teaserTitle(freeCount)).toBe(`${freeCount} free templates, ready to drop in`);
  });

  it('renders the count, the thumbnails with size attributes and the link to /templates', () => {
    const { body } = render(TemplatesTeaser, { props: { count: freeCount } });

    expect(body).toContain(`${freeCount} free templates, ready to drop in`);
    expect(body).toContain(`href="${TEASER_CTA.href}"`);
    expect(body).toContain('width="640" height="400"');
    expect(body).toContain('loading="lazy"');
  });
});
