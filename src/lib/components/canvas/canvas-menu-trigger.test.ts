import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import CanvasMenu from './CanvasMenu.svelte';

const PROPS = {
  projectId: 'p1',
  profile: { name: 'Ada', email: 'ada@example.com', avatarUrl: null },
  org: null,
  creditBalance: 0
};

describe('canvas menu trigger', () => {
  const body = render(CanvasMenu, { props: PROPS }).body;

  it('keeps its accessible name', () => {
    expect(body).toMatch(/class="burger-btn[^"]*"[^>]*aria-label="[^"]+"/);
  });

  it('shows the feega mark and a chevron, not the burger', () => {
    expect(body).toContain('feega-mark');
    expect(body).toContain('burger-chevron');
    expect(body).not.toContain('lucide-menu');
  });
});
