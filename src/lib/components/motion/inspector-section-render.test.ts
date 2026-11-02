import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import InspectorSection from './InspectorSection.svelte';

const body = createRawSnippet(() => ({ render: () => '<p>fields</p>' }));
const html = (open: boolean) => render(InspectorSection, { props: { title: 'Layout', section: 'layout', open, summary: 'Scale 150%', ontoggle: () => {}, children: body } }).body;

describe('inspector section', () => {
  it('a closed section shows its one-line summary in the head', () => {
    expect(html(false)).toMatch(/class="summary[^"]*"[^>]*>Scale 150%</);
    expect(html(false)).not.toContain('<p>fields</p>');
  });

  it('an open section shows its fields, not the summary', () => {
    expect(html(true)).toContain('<p>fields</p>');
    expect(html(true)).not.toContain('Scale 150%');
  });

  it('every section carries the shared full-bleed divider class', () => {
    expect(html(true)).toMatch(/<section class="[^"]*\bui-section\b/);
    expect(html(false)).toMatch(/<section class="[^"]*\bui-section\b/);
  });

  it('the header toggle spans the row and reports its state', () => {
    const open = html(true);
    expect(open).toMatch(/<button[^>]*class="section-head[^"]*"[^>]*aria-expanded="true"/);
    expect(html(false)).toMatch(/aria-expanded="false"/);
  });

  it('the actions come before the chevron, which closes the row', () => {
    const actions = createRawSnippet(() => ({ render: () => '<button>add</button>' }));
    const out = render(InspectorSection, { props: { title: 'Fill', section: 'fill', open: true, ontoggle: () => {}, actions, children: body } }).body;

    expect(out).toContain('>add<');
    expect(out.indexOf('class="chevron')).toBeGreaterThan(out.indexOf('>add<'));
  });

  it('a closed section is marked so its title reads muted', () => {
    expect(html(false)).toMatch(/<section class="[^"]*"[^>]*data-open="false"/);
    expect(html(true)).toMatch(/<section class="[^"]*"[^>]*data-open="true"/);
  });
});
