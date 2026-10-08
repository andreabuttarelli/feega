import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PreviewCard from './PreviewCard.svelte';

const html = (poster: string | null, preview: string | null) => render(PreviewCard, { props: { poster, preview, width: 270, height: 480 } }).body;

describe('a composition card', () => {
  it('shows a lazy poster and never a live player', () => {
    const body = html('/p.jpg', '/p.mp4');

    expect(body).toContain('src="/p.jpg"');
    expect(body).toContain('loading="lazy"');
    expect(body).toContain('width="270"');
    expect(body).not.toContain('<iframe');
    expect(body).not.toContain('composition-player');
    expect(body).not.toContain('<video');
  });

  it('without a poster shows a quiet empty state', () => {
    expect(html(null, null)).toContain('No preview yet');
  });
});
