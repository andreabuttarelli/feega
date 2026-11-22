import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

function page(name: string | null) {
  return render(Page, { props: { data: { name }, form: null } as never }).body;
}

describe('the /app dashboard: minimal page', () => {
  it('greets the user by first name under one lowercase title', () => {
    expect(page('Ada Lovelace')).toMatch(/<h1[^>]*>hi, Ada!<\/h1>/);
  });

  it('greets without a name when none is known', () => {
    expect(page(null)).toMatch(/<h1[^>]*>hi!<\/h1>/);
  });

  it('says Feega Cloud is coming and links the extension and GitHub', () => {
    const body = page('Ada');

    expect(body).toContain('Feega Cloud is coming. For now, Feega lives in your editor.');
    expect(body).toContain('href="https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega"');
    expect(body).toContain('Get the extension');
    expect(body).toContain('href="https://github.com/andreabuttarelli/feega"');
    expect(body).toContain('Star on GitHub');
  });

  it('lists no projects and offers no create action', () => {
    const body = page('Ada');

    expect(body).not.toContain('home-recents');
    expect(body).not.toContain('new-canvas');
    expect(body).not.toContain('<form');
  });
});
