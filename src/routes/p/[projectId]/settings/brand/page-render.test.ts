import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const data = {
  project: { id: 'p1' },
  orgBrands: [],
  brand: { id: 'b1', name: 'Acme', slug: 'acme', logoUrl: null, website: null, shortDescription: null, content: null },
  kit: {
    fields: { palette: '#111111 Ink', tone: 'Warm', do: 'Short', dont: 'Puns' },
    logos: [{ variant: 'dark', url: 'https://x/d.png' }],
    fonts: { heading: { google_family: 'Inter', org_font_id: null }, body: null, accent: null },
    orgFonts: [],
    assets: [{ id: 'a1', approved: true, thumb: '/t/a1' }]
  }
};

describe('brand settings: the kit', () => {
  it('edits palette, voice, fonts, logo variants and approved assets', () => {
    const html = render(Page, { props: { data, form: null } as never }).body;
    expect(html).toContain('#111111 Ink');
    expect(html).toContain('action="?/saveKit"');
    expect(html).toContain('action="?/saveFonts"');
    expect(html).toContain('value="Inter"');
    expect(html).toContain('data-variant="dark"');
    expect(html).toContain('src="https://x/d.png"');
    expect(html).toContain('aria-pressed="true"');
  });
});
