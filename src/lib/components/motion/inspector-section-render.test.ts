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
});
