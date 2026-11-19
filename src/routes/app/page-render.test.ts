import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';

function page(name: string | null) {
  return render(Page, { props: { data: { name }, form: null } as never }).body;
}

describe('the /app dashboard: a Feega Cloud preview', () => {
  it('greets the user by first name under one lowercase title', () => {
    expect(page('Ada Lovelace')).toMatch(/<h1[^>]*>hi, Ada!<\/h1>/);
  });

  it('greets without a name when none is known', () => {
    expect(page(null)).toMatch(/<h1[^>]*>hi!<\/h1>/);
  });

  it('says what will live here and points at the extension docs', () => {
    const body = page('Ada');

    expect(body).toContain("Here you'll find all the data from the upcoming Feega Cloud.");
    expect(body).toContain('Feega is a VS Code extension for now');
    expect(body).toContain('href="https://docs.feega.app/integrations/editor/"');
  });

  it('lists no projects and offers no create action', () => {
    const body = page('Ada');

    expect(body).not.toContain('home-recents');
    expect(body).not.toContain('new-canvas');
    expect(body).not.toContain('<form');
  });
});
